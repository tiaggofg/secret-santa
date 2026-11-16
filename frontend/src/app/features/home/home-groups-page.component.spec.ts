import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HomeGroupsPageComponent } from './home-groups-page.component';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';
import { AuthSessionStore } from '../../core/auth/auth-session.store';
import { DeviceSessionGeoStore } from '../../core/geolocation/device-session-geo.store';
import { ToastService } from '../../shared/toast/toast.service';

describe('HomeGroupsPageComponent', () => {
  let fixture: ComponentFixture<HomeGroupsPageComponent>;
  let component: HomeGroupsPageComponent;
  let authStore: AuthSessionStore;
  let geoStore: DeviceSessionGeoStore;

  const apiMock = {
    login: vi.fn(),
    logout: vi.fn(),
    listGroups: vi.fn(),
    createGroup: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    apiMock.logout.mockReturnValue(of(void 0));
    apiMock.listGroups.mockReturnValue(
      of({
        myGroups: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            eventName: 'Natal Família Godoy',
            organizerUserId: 'u-1',
            status: 'OPEN',
            participantCount: 4,
            organizer: true,
            joined: true,
            sharePath: '/g/11111111-1111-1111-1111-111111111111',
            createdAt: '2026-11-13T18:00:00Z',
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
        { provide: SecretSantaApiService, useValue: apiMock }
      ]
    }).compileComponents();

    authStore = TestBed.inject(AuthSessionStore);
    geoStore = TestBed.inject(DeviceSessionGeoStore);
    fixture = TestBed.createComponent(HomeGroupsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders direct login form without tablist, simplified hero and link to /cadastro', () => {
    expect(fixture.nativeElement.querySelector('[role="tablist"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="login-form"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Entre para criar seu Amigo Secreto ou participar dos sorteios com a família e amigos!'
    );
    expect(fixture.nativeElement.textContent).not.toContain('Sem e-mail');
    expect(fixture.nativeElement.textContent.toLowerCase()).not.toContain('username');

    const registerLink: HTMLAnchorElement = fixture.nativeElement.querySelector(
      '[data-testid="go-to-register-link"]'
    );
    expect(registerLink).not.toBeNull();
    expect(registerLink.textContent).toContain('Não tem uma conta? Clique aqui');
    expect(registerLink.getAttribute('href')).toBe('/cadastro');
  });

  it('logs in existing user with nome de usuário + senha and displays only My Groups', () => {
    apiMock.login.mockReturnValue(
      of({
        userId: 'u-1',
        name: 'Tiago Godoy',
        username: 'tiago.godoy'
      })
    );

    component.loginForm.setValue({
      username: 'tiago.godoy',
      password: 'Natal@2026'
    });
    const loginForm: HTMLFormElement = fixture.nativeElement.querySelector('[data-testid="login-form"]');
    loginForm.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(apiMock.login).toHaveBeenCalledWith({
      username: 'tiago.godoy',
      password: 'Natal@2026'
    });
    expect(authStore.isAuthenticated()).toBe(true);
    expect(component.myGroups().length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Meus Grupos');
    expect(fixture.nativeElement.textContent).toContain('Natal Família Godoy');
    expect(fixture.nativeElement.textContent).toContain('+ Novo Amigo Secreto');
  });

  it('opens Novo Amigo Secreto modal without groupPin field and creates group on submit', () => {
    authStore.setSession({
      userId: 'u-1',
      name: 'Tiago Godoy',
      username: 'tiago.godoy'
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="create-group-modal"]')).toBeNull();

    const openModalBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="open-create-group-modal-btn"]'
    );
    expect(openModalBtn.textContent).toContain('+ Novo Amigo Secreto');
    openModalBtn.click();
    fixture.detectChanges();

    const modal: HTMLElement = fixture.nativeElement.querySelector('[data-testid="create-group-modal"]');
    expect(modal).not.toBeNull();
    expect(modal.textContent).toContain('Novo Amigo Secreto');
    expect(modal.textContent).toContain('Criar Amigo Secreto');
    expect(modal.querySelector('[data-testid="group-pin-input"]')).toBeNull();

    apiMock.createGroup.mockReturnValue(
      of({
        id: '22222222-2222-2222-2222-222222222222',
        eventName: 'Natal 2026',
        organizerUserId: 'u-1',
        status: 'OPEN',
        geographicRestrictionRelaxed: false,
        sharePath: '/g/22222222-2222-2222-2222-222222222222?sig=sig_abc123',
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
    expect(fixture.nativeElement.querySelector('[data-testid="create-group-modal"]')).toBeNull();
    const toastService = TestBed.inject(ToastService);
    expect(toastService.toasts().some((t) => t.message.includes('Grupo "Natal 2026" criado com sucesso!'))).toBe(true);
    toastService.clear();
  });

  it('calls POST /auth/logout and clears AuthSessionStore while preserving DeviceSessionGeoStore when clicking Trocar / Sair', () => {
    authStore.setSession({
      userId: 'u-parent',
      name: 'Pai',
      username: 'pai.silva'
    });
    geoStore.saveCapturedCoordinates(-23.5505, -46.6333);
    fixture.detectChanges();

    const switchBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="switch-family-user-btn"]'
    );
    expect(switchBtn).not.toBeNull();
    switchBtn.click();
    fixture.detectChanges();

    expect(apiMock.logout).toHaveBeenCalled();
    expect(authStore.isAuthenticated()).toBe(false);
    expect(authStore.session()).toBeNull();
    expect(geoStore.hasCapturedValidCoordinates()).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="login-form"]')).not.toBeNull();
  });
});
