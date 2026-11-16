import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PublicGroupPageComponent } from './public-group-page.component';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';
import { AuthSessionStore } from '../../core/auth/auth-session.store';
import { BrowserGeolocationService } from '../../core/geolocation/browser-geolocation.service';
import { DeviceSessionGeoStore } from '../../core/geolocation/device-session-geo.store';
import { PublicGroupView } from '../../core/api/secret-santa-api.models';
import { ToastService } from '../../shared/toast/toast.service';

describe('PublicGroupPageComponent', () => {
  let fixture: ComponentFixture<PublicGroupPageComponent>;
  let component: PublicGroupPageComponent;
  let authStore: AuthSessionStore;
  let router: Router;

  const groupId = '11111111-1111-1111-1111-111111111111';
  const validSig = 'sig_valid_hmac_signature_123456';

  const openValidInviteGroupMock: PublicGroupView = {
    id: groupId,
    eventName: 'Natal Família Silva',
    organizerUserId: 'org-1',
    status: 'OPEN',
    geographicRestrictionRelaxed: false,
    sharePath: `/g/${groupId}`,
    organizer: false,
    joined: false,
    inviteValid: true,
    participantsVisible: false,
    participantCount: 1,
    createdAt: '2026-11-13T18:00:00Z',
    drawnAt: null,
    participants: []
  };

  const drawnVisibleGroupMock: PublicGroupView = {
    ...openValidInviteGroupMock,
    status: 'DRAWN',
    joined: true,
    inviteValid: true,
    participantsVisible: true,
    participantCount: 2,
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
    joinGroup: vi.fn(),
    revealMatch: vi.fn(),
    me: vi.fn()
  };

  const geoServiceMock = {
    captureCoordinatesForJoin: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    apiMock.getPublicGroup.mockReturnValue(of(openValidInviteGroupMock));
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
              paramMap: convertToParamMap({ groupId }),
              queryParamMap: convertToParamMap({ sig: validSig })
            }
          }
        },
        { provide: SecretSantaApiService, useValue: apiMock },
        { provide: BrowserGeolocationService, useValue: geoServiceMock }
      ]
    }).compileComponents();

    authStore = TestBed.inject(AuthSessionStore);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(PublicGroupPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens on visitor login when inviteValid is true, hides participant list for non-members and switches to inline register with strong password', async () => {
    expect(apiMock.getPublicGroup).toHaveBeenCalledWith(groupId, validSig);
    expect(fixture.nativeElement.querySelector('[role="tablist"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="visitor-login-form"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="public-participants-list"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="private-participants-notice"]')).not.toBeNull();

    const goToRegisterBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="visitor-go-to-register-link"]'
    );
    goToRegisterBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="password-criteria-indicator"]')).not.toBeNull();

    apiMock.joinGroup.mockReturnValue(
      of({
        id: 'p-vis',
        userId: 'u-vis',
        name: 'Joãozinho Silva',
        username: 'joaozinho.silva',
        hasGeoLocation: true,
        revealStatus: 'WAITING_DRAW',
        createdAt: '2026-11-13T18:05:00Z',
        groupId,
        sharePath: `/g/${groupId}`
      })
    );

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('#vis-name');
    nameInput.value = 'Joãozinho Silva';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.visitorRegisterForm.controls.username.value).toBe('joaozinho.silva');

    component.visitorRegisterForm.controls.password.setValue('Natal@2026');

    const form: HTMLFormElement = fixture.nativeElement.querySelector('[data-testid="visitor-register-form"]');
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(apiMock.joinGroup).toHaveBeenCalledWith(groupId, {
      name: 'Joãozinho Silva',
      username: 'joaozinho.silva',
      password: 'Natal@2026',
      inviteSignature: validSig,
      latitude: -23.5505,
      longitude: -46.6333
    });
    expect(authStore.isAuthenticated()).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(['/g', groupId], { replaceUrl: true });
  });

  it('handles 409 ALREADY_PARTICIPANT on visitor login by authenticating, stripping ?sig=, showing status and reloading group', async () => {
    apiMock.joinGroup.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            statusText: 'Conflict',
            error: {
              errorCode: 'ALREADY_PARTICIPANT',
              userId: 'u-1',
              name: 'Maria Silva',
              username: 'maria.silva',
              groupId,
              redirectPath: `/g/${groupId}`
            }
          })
      )
    );
    apiMock.getPublicGroup.mockReturnValue(
      of({
        ...openValidInviteGroupMock,
        joined: true,
        participantsVisible: true,
        participants: [drawnVisibleGroupMock.participants[0]]
      })
    );

    component.visitorLoginForm.setValue({
      username: 'maria.silva',
      password: 'Natal@2026'
    });
    await component.submitVisitorLoginAndJoin();
    fixture.detectChanges();

    expect(authStore.isAuthenticated()).toBe(true);
    expect(authStore.username()).toBe('maria.silva');
    expect(router.navigate).toHaveBeenCalledWith(['/g', groupId], { replaceUrl: true });
    const toastService = TestBed.inject(ToastService);
    expect(toastService.toasts().some((t) => t.message.includes('Você já está inscrito neste grupo!'))).toBe(true);
    toastService.clear();
    expect(fixture.nativeElement.querySelector('[data-testid="already-joined-confirmation"]')?.textContent).toContain(
      'Você já está inscrito neste grupo, Maria Silva!'
    );
    expect(fixture.nativeElement.querySelector('[data-testid="public-participants-list"]')).not.toBeNull();
  });

  it('blocks registration and displays invalid-invite-notice when inviteValid is false and user is not organizer', () => {
    component.group.set({
      ...openValidInviteGroupMock,
      inviteValid: false,
      organizer: false,
      joined: false
    });
    fixture.detectChanges();

    const notice = fixture.nativeElement.querySelector('[data-testid="invalid-invite-notice"]');
    expect(notice).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="visitor-login-form"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="authenticated-join-btn"]')).toBeNull();
  });

  it('shows 403 error message when invite link is invalid or rotated during join attempt', async () => {
    apiMock.joinGroup.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' }))
    );

    component.visitorLoginForm.setValue({
      username: 'maria.silva',
      password: 'Natal@2026'
    });
    await component.submitVisitorLoginAndJoin();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[data-testid="public-group-error"]');
    expect(alert?.textContent).toContain('Link de convite inválido ou expirado');
  });

  it('displays greeting without @username and sends inviteSignature for non-organizer authenticated user, bypassing signature for organizer', async () => {
    authStore.setSession({
      userId: 'u-55',
      name: 'Pedro Silva',
      username: 'pedro.silva'
    });
    component.group.set({ ...openValidInviteGroupMock, organizer: false, joined: false, inviteValid: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Olá, Pedro Silva. Toque abaixo para confirmar sua participação neste grupo:'
    );

    component.group.set({ ...openValidInviteGroupMock, organizer: true, joined: false, inviteValid: true });
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
        groupId,
        sharePath: `/g/${groupId}`
      })
    );

    const joinBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="authenticated-join-btn"]'
    );
    joinBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(apiMock.joinGroup).toHaveBeenCalledWith(groupId, {
      inviteSignature: undefined,
      latitude: -23.5505,
      longitude: -46.6333
    });
  });

  it('displays reveal form even when inviteValid is false and participants are hidden in DRAWN state, and pre-fills when visible', () => {
    apiMock.getPublicGroup.mockReturnValue(
      of({
        ...openValidInviteGroupMock,
        status: 'DRAWN',
        inviteValid: false,
        participantsVisible: false,
        participants: []
      })
    );
    component.loadPublicGroup();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="reveal-form-section"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="public-participants-list"]')).toBeNull();

    apiMock.getPublicGroup.mockReturnValue(of(drawnVisibleGroupMock));
    component.loadPublicGroup();
    fixture.detectChanges();

    const items: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll(
      '[data-testid="participant-list-item"]'
    );
    expect(items.length).toBe(2);
    items[0].click();
    fixture.detectChanges();
    expect(component.revealForm.controls.username.value).toBe('maria.silva');
  });

  it('reveals Secret Santa match with valid nome de usuário + password and opens EphemeralRevealModalComponent', () => {
    apiMock.getPublicGroup.mockReturnValue(of(drawnVisibleGroupMock));
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
      password: 'Natal@2026'
    });

    const revealFormEl: HTMLFormElement = fixture.nativeElement.querySelector('[data-testid="reveal-form"]');
    revealFormEl.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(apiMock.revealMatch).toHaveBeenCalledWith(groupId, {
      username: 'maria.silva',
      password: 'Natal@2026'
    });
    expect(component.revealForm.controls.password.value).toBe('');
    expect(fixture.nativeElement.querySelector('[data-testid="drawn-participant-name"]')?.textContent).toContain(
      'Lucas Silva'
    );
  });
});
