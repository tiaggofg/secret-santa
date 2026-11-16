import { inject, Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest
} from '@angular/common/http';
import { catchError, finalize, Observable, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthSessionView } from '../api/secret-santa-api.models';
import { AuthSessionStore } from './auth-session.store';

@Injectable({
  providedIn: 'root'
})
export class AuthRefreshCoordinator {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthSessionStore);
  private refreshInFlight$: Observable<AuthSessionView> | null = null;

  refreshOnce(): Observable<AuthSessionView> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.http
        .post<AuthSessionView>(
          `${environment.apiUrl}/api/v1/auth/refresh`,
          {},
          { withCredentials: true }
        )
        .pipe(
          tap((user) => this.authStore.setSession(user)),
          shareReplay(1),
          finalize(() => {
            this.refreshInFlight$ = null;
          })
        );
    }
    return this.refreshInFlight$;
  }
}

function isApiRequest(url: string): boolean {
  if (url.startsWith('/api')) {
    return true;
  }
  return environment.apiUrl.length > 0 && url.startsWith(environment.apiUrl);
}

function shouldSkipAutoRefresh(req: HttpRequest<unknown>, isAuthenticated: boolean): boolean {
  const url = req.url;
  if (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout') ||
    url.includes('/participants/reveal')
  ) {
    return true;
  }
  if (url.includes('/participants')) {
    const body = req.body as Record<string, unknown> | null;
    if (!isAuthenticated || (body != null && ('username' in body || 'name' in body))) {
      return true;
    }
  }
  return false;
}

export const authCredentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) {
    return next(req);
  }

  const authStore = inject(AuthSessionStore);
  const refreshCoordinator = inject(AuthRefreshCoordinator);
  const credentialedReq = req.clone({ withCredentials: true });

  return next(credentialedReq).pipe(
    catchError((err: unknown) => {
      if (
        !(err instanceof HttpErrorResponse) ||
        err.status !== 401 ||
        shouldSkipAutoRefresh(credentialedReq, authStore.isAuthenticated())
      ) {
        return throwError(() => err);
      }

      return refreshCoordinator.refreshOnce().pipe(
        switchMap(() => next(credentialedReq)),
        catchError((refreshErr: unknown) => {
          authStore.clear();
          return throwError(() => refreshErr);
        })
      );
    })
  );
};
