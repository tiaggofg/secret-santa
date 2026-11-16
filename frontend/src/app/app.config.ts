import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { catchError, firstValueFrom, of, tap } from 'rxjs';
import { routes } from './app.routes';
import { authCredentialsInterceptor } from './core/auth/auth-credentials.interceptor';
import { AuthSessionStore } from './core/auth/auth-session.store';
import { SecretSantaApiService } from './core/api/secret-santa-api.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authCredentialsInterceptor])),
    provideAppInitializer(() => {
      const api = inject(SecretSantaApiService);
      const authStore = inject(AuthSessionStore);
      return firstValueFrom(
        api.me().pipe(
          tap((user) => authStore.setSession(user)),
          catchError(() => {
            authStore.clear();
            return of(null);
          })
        )
      );
    })
  ]
};
