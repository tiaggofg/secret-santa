import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HomeGroupsPageComponent } from './home-groups-page.component';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';
import { AuthSessionStore } from '../../core/auth/auth-session.store';
import { BrowserGeolocationService } from '../../core/geolocation/browser-geolocation.service';
import { DeviceSessionGeoStore } from '../../core/geolocation/device-session-geo.store';

describe('HomeGroupsPageComponent', () => {
  let fixture: ComponentFixture<HomeGroupsPageComponent>;
  let component: HomeGroupsPageComponent;
  let authStore: AuthSessionStore;
  let geoStore: DeviceSessionGeoStore;

  const apiMock = {
    register: vi.fn(),
    login: vi.fn(),
    listGroups: vi.fn(),
    joinGroup: vi.fn(),
    createGroup: vi.fn()
  };

  const geoServiceMock = {
    captureCoordinatesForJoin: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    apiMock.listGroups.mockReturnValue(
      of({
        myGroups: [
          {
            id: 'g-my-1',
            slug: 'familia-godoy-1',
            publicSlug: 'familia-godoy-1',
            eventName: 'Natal Família Godoy',
            organizerUserId: 'u-1',
            status: 'OPEN',
            participantCount: 4,
            organizer: true,
            joined: true,
            sharePath: '/g/familia-godoy-1',
            createdAt: '2026-11-13T18:00:00Z',
            drawnAt: null
          }
        ],
        availableGroups: [
          {
            id: 'g-av-1',
            slug: 'primos-2026',
            publicSlug: 'primos-2026',
            eventName: 'Amigo Secreto dos Primos',
            organizerUserId: 'u-99',
            status: 'OPEN',
            participantCount: 2,
            organizer: false,
            joined: false,
            sharePath: '/g/primos-2026',
            createdAt: '2026-11-13T18:10:00Z',
            drawnAt: null
          }
        ]
      })
    );

    await TestBed.configureTestingModule({
      imports: [HomeGroupsPageComponent],
      providers: [
        provideRouter([]),
        AuthSessionStore,
        DeviceSessionGeoStore,
        { provide: SecretSantaApiService, useValue: apiMock },
        { provide: BrowserGeolocationService, useValue: geoServiceMock }
      ]
    }).compileComponents();

    authStore = TestBed.inject(AuthSessionStore);
    geoStore = TestBed.inject(DeviceSessionGeoStore);
    fixture = TestBed.createComponent(HomeGroupsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('auto-suggests username from name during basic registration and loads My Groups & Available Groups on submit', () => {
    apiMock.register.mockReturnValue(
      of({
        token: 'tok-reg',
        userId: 'u-1',
        name: 'Maria Clara',
        username: 'maria.clara'
      })
    );

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('#reg-name');
    nameInput.value = 'Maria Clara';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.registerForm.controls.username.value).toBe('maria.clara');

    const pinInput: HTMLInputElement = fixture.nativeElement.querySelector('#reg-pin');
    pinInput.value = '1234';
    pinInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form: HTMLFormElement = fixture.nativeElement.querySelector('[data-testid="register-form"]');
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(apiMock.register).toHaveBeenCalledWith({
      name: 'Maria Clara',
      username: 'maria.clara',
      pin: '1234'
    });
    expect(authStore.isAuthenticated()).toBe(true);
    expect(apiMock.listGroups).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Meus Grupos');
    expect(fixture.nativeElement.textContent).toContain('Natal Família Godoy');
    expect(fixture.nativeElement.textContent).toContain('Grupos Disponíveis (Abertos)');
    expect(fixture.nativeElement.textContent).toContain('Amigo Secreto dos Primos');
  });

  it('shows helpful suggestion when registration fails with HTTP 409 duplicate username', () => {
    apiMock.register.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, statusText: 'Conflict' }))
    );

    component.registerForm.setValue({
      name: 'Maria Silva',
      username: 'maria.silva',
      pin: '1234'
    });
    component.submitRegister();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[data-testid="auth-error"]');
    expect(alert?.textContent).toContain('já está em uso');
  });

  it('logs in existing user with username + PIN and displays groups', () => {
    apiMock.login.mockReturnValue(
      of({
        token: 'tok-login',
        userId: 'u-1',
        name: 'Tiago Godoy',
        username: 'tiago.godoy'
      })
    );

    const loginTab: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="tab-login"]');
    loginTab.click();
    fixture.detectChanges();

    component.loginForm.setValue({
      username: 'tiago.godoy',
      pin: '4321'
    });
    const loginForm: HTMLFormElement = fixture.nativeElement.querySelector('[data-testid="login-form"]');
    loginForm.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(apiMock.login).toHaveBeenCalledWith({
      username: 'tiago.godoy',
      pin: '4321'
    });
    expect(authStore.isAuthenticated()).toBe(true);
    expect(component.myGroups().length).toBe(1);
    expect(component.availableGroups().length).toBe(1);
  });

  it('joins an available group with 1 tap using GPS coordinates when granted', async () => {
    authStore.setSession({
      token: 'tok-1',
      userId: 'u-1',
      name: 'Tiago Godoy',
      username: 'tiago.godoy'
    });
    fixture.detectChanges();

    geoServiceMock.captureCoordinatesForJoin.mockResolvedValue({
      latitude: -23.42,
      longitude: -51.93,
      fallbackUsed: false,
      reusedFromSession: false
    });
    apiMock.joinGroup.mockReturnValue(
      of({
        id: 'p-1',
        userId: 'u-1',
        name: 'Tiago Godoy',
        username: 'tiago.godoy',
        hasGeoLocation: true,
        revealStatus: 'WAITING_DRAW',
        createdAt: '2026-11-13T18:15:00Z',
        groupSlug: 'primos-2026',
        token: null
      })
    );

    const joinBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="join-group-btn"]');
    joinBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(geoServiceMock.captureCoordinatesForJoin).toHaveBeenCalledTimes(1);
    expect(apiMock.joinGroup).toHaveBeenCalledWith('primos-2026', {
      latitude: -23.42,
      longitude: -51.93
    });
    expect(fixture.nativeElement.querySelector('[data-testid="geo-fallback-notice"]')).toBeNull();
  });

  it('completes group join with latitude=null and longitude=null and displays non-blocking notice when GPS is denied or times out (C9)', async () => {
    authStore.setSession({
      token: 'tok-1',
      userId: 'u-1',
      name: 'Tiago Godoy',
      username: 'tiago.godoy'
    });
    fixture.detectChanges();

    geoServiceMock.captureCoordinatesForJoin.mockResolvedValue({
      latitude: null,
      longitude: null,
      fallbackUsed: true,
      reusedFromSession: false
    });
    apiMock.joinGroup.mockReturnValue(
      of({
        id: 'p-2',
        userId: 'u-1',
        name: 'Tiago Godoy',
        username: 'tiago.godoy',
        hasGeoLocation: false,
        revealStatus: 'WAITING_DRAW',
        createdAt: '2026-11-13T18:16:00Z',
        groupSlug: 'primos-2026',
        token: null
      })
    );

    const joinBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="join-group-btn"]');
    joinBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(apiMock.joinGroup).toHaveBeenCalledWith('primos-2026', {
      latitude: null,
      longitude: null
    });
    const fallbackBanner = fixture.nativeElement.querySelector('[data-testid="geo-fallback-notice"]');
    expect(fallbackBanner).not.toBeNull();
    expect(fallbackBanner.textContent).toContain('sem GPS');
  });

  it('creates a new group when authenticated user submits eventName', () => {
    authStore.setSession({
      token: 'tok-1',
      userId: 'u-1',
      name: 'Tiago Godoy',
      username: 'tiago.godoy'
    });
    fixture.detectChanges();

    apiMock.createGroup.mockReturnValue(
      of({
        id: 'g-new',
        slug: 'natal-2026-a1b2',
        publicSlug: 'natal-2026-a1b2',
        eventName: 'Natal 2026',
        organizerUserId: 'u-1',
        status: 'OPEN',
        geographicRestrictionRelaxed: false,
        sharePath: '/g/natal-2026-a1b2',
        createdAt: '2026-11-13T18:20:00Z',
        drawnAt: null,
        participants: []
      })
    );

    component.createGroupForm.setValue({ eventName: 'Natal 2026' });
    const createForm: HTMLFormElement = fixture.nativeElement.querySelector('[data-testid="create-group-form"]');
    createForm.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(apiMock.createGroup).toHaveBeenCalledWith({ eventName: 'Natal 2026' });
    expect(fixture.nativeElement.textContent).toContain('Grupo "Natal 2026" criado com sucesso!');
  });

  it('clears AuthSessionStore in memory while preserving DeviceSessionGeoStore when clicking switch family user button (C12)', () => {
    authStore.setSession({
      token: 'tok-parent',
      userId: 'u-parent',
      name: 'Pai',
      username: 'pai.silva'
    });
    geoStore.saveCapturedCoordinates(-23.5505, -46.6333);
    fixture.detectChanges();

    const switchBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="switch-family-user-btn"]'
    );
    expect(switchBtn.textContent).toContain('Cadastrar outro familiar / Trocar de usuário neste aparelho');
    switchBtn.click();
    fixture.detectChanges();

    expect(authStore.isAuthenticated()).toBe(false);
    expect(authStore.session()).toBeNull();
    expect(geoStore.hasCapturedValidCoordinates()).toBe(true);
    expect(geoStore.coordinates()).toEqual({
      latitude: -23.5505,
      longitude: -46.6333
    });
    expect(fixture.nativeElement.querySelector('[data-testid="register-form"]')).not.toBeNull();
  });
});
