import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PublicGroupPageComponent } from './public-group-page.component';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';
import { AuthSessionStore } from '../../core/auth/auth-session.store';
import { BrowserGeolocationService } from '../../core/geolocation/browser-geolocation.service';
import { DeviceSessionGeoStore } from '../../core/geolocation/device-session-geo.store';
import { PublicGroupView } from '../../core/api/secret-santa-api.models';

describe('PublicGroupPageComponent', () => {
  let fixture: ComponentFixture<PublicGroupPageComponent>;
  let component: PublicGroupPageComponent;
  let authStore: AuthSessionStore;
  let geoStore: DeviceSessionGeoStore;

  const openGroupMock: PublicGroupView = {
    id: 'g-1',
    slug: 'natal-silva-a8f2',
    publicSlug: 'natal-silva-a8f2',
    eventName: 'Natal Família Silva',
    organizerUserId: 'org-1',
    status: 'OPEN',
    geographicRestrictionRelaxed: false,
    sharePath: '/g/natal-silva-a8f2',
    organizer: false,
    joined: false,
    createdAt: '2026-11-13T18:00:00Z',
    drawnAt: null,
    participants: [
      {
        id: 'p-1',
        userId: 'u-1',
        name: 'Maria Silva',
        username: 'maria.silva',
        hasGeoLocation: true,
        revealStatus: 'WAITING_DRAW',
        createdAt: '2026-11-13T18:01:00Z'
      }
    ]
  };

  const drawnGroupMock: PublicGroupView = {
    ...openGroupMock,
    status: 'DRAWN',
    drawnAt: '2026-11-13T19:00:00Z',
    participants: [
      {
        id: 'p-1',
        userId: 'u-1',
        name: 'Maria Silva',
        username: 'maria.silva',
        hasGeoLocation: true,
        revealStatus: 'PENDING_REVEAL',
        createdAt: '2026-11-13T18:01:00Z'
      },
      {
        id: 'p-2',
        userId: 'u-2',
        name: 'Lucas Silva',
        username: 'lucas.silva',
        hasGeoLocation: true,
        revealStatus: 'REVEALED',
        createdAt: '2026-11-13T18:02:00Z'
      }
    ]
  };

  const apiMock = {
    getPublicGroup: vi.fn(),
    register: vi.fn(),
    login: vi.fn(),
    joinGroup: vi.fn(),
    revealMatch: vi.fn()
  };

  const geoServiceMock = {
    captureCoordinatesForJoin: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    apiMock.getPublicGroup.mockReturnValue(of(openGroupMock));
    geoServiceMock.captureCoordinatesForJoin.mockResolvedValue({
      latitude: -23.5505,
      longitude: -46.6333,
      fallbackUsed: false,
      reusedFromSession: false
    });

    await TestBed.configureTestingModule({
      imports: [PublicGroupPageComponent],
      providers: [
        provideRouter([]),
        AuthSessionStore,
        DeviceSessionGeoStore,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ slug: 'natal-silva-a8f2' })
            }
          }
        },
        { provide: SecretSantaApiService, useValue: apiMock },
        { provide: BrowserGeolocationService, useValue: geoServiceMock }
      ]
    }).compileComponents();

    authStore = TestBed.inject(AuthSessionStore);
    geoStore = TestBed.inject(DeviceSessionGeoStore);
    fixture = TestBed.createComponent(PublicGroupPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('allows an unauthenticated visitor arriving via WhatsApp link /g/:slug while OPEN to register and automatically join the group (C10)', async () => {
    apiMock.register.mockReturnValue(
      of({
        token: 'tok-vis',
        userId: 'u-vis',
        name: 'Joãozinho Silva',
        username: 'joaozinho.silva'
      })
    );
    apiMock.joinGroup.mockReturnValue(
      of({
        id: 'p-vis',
        userId: 'u-vis',
        name: 'Joãozinho Silva',
        username: 'joaozinho.silva',
        hasGeoLocation: true,
        revealStatus: 'WAITING_DRAW',
        createdAt: '2026-11-13T18:05:00Z',
        groupSlug: 'natal-silva-a8f2',
        token: 'tok-vis'
      })
    );

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('#vis-name');
    nameInput.value = 'Joãozinho Silva';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.visitorRegisterForm.controls.username.value).toBe('joaozinho.silva');

    const pinInput: HTMLInputElement = fixture.nativeElement.querySelector('#vis-pin');
    pinInput.value = '1234';
    pinInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form: HTMLFormElement = fixture.nativeElement.querySelector(
      '[data-testid="visitor-register-form"]'
    );
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(geoServiceMock.captureCoordinatesForJoin).toHaveBeenCalledTimes(1);
    expect(apiMock.register).toHaveBeenCalledWith({
      name: 'Joãozinho Silva',
      username: 'joaozinho.silva',
      pin: '1234'
    });
    expect(apiMock.joinGroup).toHaveBeenCalledWith('natal-silva-a8f2', {
      latitude: -23.5505,
      longitude: -46.6333
    });
    expect(authStore.isAuthenticated()).toBe(true);
  });

  it('allows switching family user on /g/:slug after joining to register a dependent on the same phone reusing DeviceSessionGeoStore', () => {
    authStore.setSession({
      token: 'tok-parent',
      userId: 'u-1',
      name: 'Maria Silva',
      username: 'maria.silva'
    });
    geoStore.saveCapturedCoordinates(-23.5505, -46.6333);
    component.group.set({ ...openGroupMock, joined: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="already-joined-confirmation"]')).not.toBeNull();

    const switchBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="public-switch-family-user-btn"]'
    );
    switchBtn.click();
    fixture.detectChanges();

    expect(authStore.isAuthenticated()).toBe(false);
    expect(geoStore.hasCapturedValidCoordinates()).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="visitor-register-form"]')).not.toBeNull();
  });

  it('displays reveal form and participant list when DRAWN, pre-filling username when clicking a participant item (C29)', () => {
    apiMock.getPublicGroup.mockReturnValue(of(drawnGroupMock));
    component.loadPublicGroup();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="reveal-form-section"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('PENDING_REVEAL');
    expect(fixture.nativeElement.textContent).toContain('REVEALED');

    const items: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll(
      '[data-testid="participant-list-item"]'
    );
    expect(items.length).toBe(2);
    items[0].click();
    fixture.detectChanges();

    expect(component.revealForm.controls.username.value).toBe('maria.silva');
  });

  it('reveals Secret Santa match with valid username + PIN, clears PIN input, and opens EphemeralRevealModalComponent', () => {
    apiMock.getPublicGroup.mockReturnValue(of(drawnGroupMock));
    component.loadPublicGroup();
    fixture.detectChanges();

    apiMock.revealMatch.mockReturnValue(
      of({
        participantId: 'p-1',
        username: 'maria.silva',
        drawnParticipantName: 'Lucas Silva',
        revealedAt: '2026-11-13T19:10:00Z'
      })
    );

    component.revealForm.setValue({
      username: 'maria.silva',
      pin: '1234'
    });

    const revealFormEl: HTMLFormElement = fixture.nativeElement.querySelector('[data-testid="reveal-form"]');
    revealFormEl.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(apiMock.revealMatch).toHaveBeenCalledWith('natal-silva-a8f2', {
      username: 'maria.silva',
      pin: '1234'
    });
    expect(component.revealForm.controls.pin.value).toBe('');
    expect(fixture.nativeElement.querySelector('[data-testid="drawn-participant-name"]')?.textContent).toContain(
      'Lucas Silva'
    );

    // Close modal and verify wipe
    const closeBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="close-and-pass-phone-btn"]'
    );
    closeBtn.click();
    fixture.detectChanges();

    expect(component.revealedFriendName()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="drawn-participant-name"]')).toBeNull();
  });

  it('clears PIN field and shows error message when reveal fails with HTTP 401 invalid PIN', () => {
    apiMock.getPublicGroup.mockReturnValue(of(drawnGroupMock));
    component.loadPublicGroup();
    fixture.detectChanges();

    apiMock.revealMatch.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }))
    );

    component.revealForm.setValue({
      username: 'maria.silva',
      pin: '9999'
    });
    component.submitReveal();
    fixture.detectChanges();

    expect(component.revealForm.controls.pin.value).toBe('');
    expect(fixture.nativeElement.querySelector('[data-testid="public-group-error"]')?.textContent).toContain(
      'Usuário ou PIN incorreto'
    );
  });

  it('allows an already authenticated user who opens /g/:slug while OPEN to join with 1 tap', async () => {
    authStore.setSession({
      token: 'tok-auth',
      userId: 'u-55',
      name: 'Pedro Silva',
      username: 'pedro.silva'
    });
    component.group.set({ ...openGroupMock, joined: false });
    fixture.detectChanges();

    apiMock.joinGroup.mockReturnValue(
      of({
        id: 'p-55',
        userId: 'u-55',
        name: 'Pedro Silva',
        username: 'pedro.silva',
        hasGeoLocation: true,
        revealStatus: 'WAITING_DRAW',
        createdAt: '2026-11-13T18:10:00Z',
        groupSlug: 'natal-silva-a8f2',
        token: null
      })
    );

    const joinBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="authenticated-join-btn"]'
    );
    joinBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(apiMock.joinGroup).toHaveBeenCalledWith('natal-silva-a8f2', {
      latitude: -23.5505,
      longitude: -46.6333
    });
  });
});
