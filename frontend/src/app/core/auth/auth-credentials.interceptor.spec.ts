import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authCredentialsInterceptor } from './auth-credentials.interceptor';
import { AuthSessionStore } from './auth-session.store';

describe('authCredentialsInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authStore: AuthSessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authCredentialsInterceptor])),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authStore = TestBed.inject(AuthSessionStore);
    authStore.setSession({ userId: 'u-1', name: 'Tiago', username: 'tiago' });
  });

  afterEach(() => {
    httpMock.verify();
    authStore.clear();
  });

  it('should attach withCredentials to API requests and refresh single-flight on 401', () => {
    let groupsResponse: unknown;
    let meResponse: unknown;

    http.get('/api/v1/groups').subscribe((res) => (groupsResponse = res));
    http.get('/api/v1/auth/me').subscribe((res) => (meResponse = res));

    const req1 = httpMock.expectOne('/api/v1/groups');
    const req2 = httpMock.expectOne('/api/v1/auth/me');
    expect(req1.request.withCredentials).toBe(true);
    expect(req2.request.withCredentials).toBe(true);

    req1.flush({ detail: 'Expired' }, { status: 401, statusText: 'Unauthorized' });
    req2.flush({ detail: 'Expired' }, { status: 401, statusText: 'Unauthorized' });

    // Only one /auth/refresh request should be issued
    const refreshReq = httpMock.expectOne('/api/v1/auth/refresh');
    expect(refreshReq.request.withCredentials).toBe(true);
    refreshReq.flush({ userId: 'u-1', name: 'Tiago', username: 'tiago' });

    const retry1 = httpMock.expectOne('/api/v1/groups');
    const retry2 = httpMock.expectOne('/api/v1/auth/me');
    retry1.flush({ myGroups: [] });
    retry2.flush({ userId: 'u-1', name: 'Tiago', username: 'tiago' });

    expect(groupsResponse).toEqual({ myGroups: [] });
    expect(meResponse).toEqual({ userId: 'u-1', name: 'Tiago', username: 'tiago' });
  });

  it('should clear session when refresh fails with 401', () => {
    let capturedStatus = 0;
    http.get('/api/v1/groups').subscribe({
      error: (err) => (capturedStatus = err.status)
    });

    httpMock.expectOne('/api/v1/groups').flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/v1/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(capturedStatus).toBe(401);
    expect(authStore.isAuthenticated()).toBe(false);
  });

  it('should not trigger refresh on login or reveal 401 errors', () => {
    let loginErr = 0;
    http.post('/api/v1/auth/login', { username: 'a', password: 'b' }).subscribe({
      error: (err) => (loginErr = err.status)
    });
    httpMock.expectOne('/api/v1/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(loginErr).toBe(401);

    let revealErr = 0;
    http.post('/api/v1/groups/g1/participants/reveal', { username: 'a', password: 'b' }).subscribe({
      error: (err) => (revealErr = err.status)
    });
    httpMock
      .expectOne('/api/v1/groups/g1/participants/reveal')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(revealErr).toBe(401);
  });
});
