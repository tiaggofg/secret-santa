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
    revealMatch: vi.fn()
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
    fixture = TestBed.createComponent(PublicGroupPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens on visitor login when inviteValid is true, hides participant list for non-members and switches to inline register without groupPin', async () => {
    expect(apiMock.getPublicGroup).toHaveBeenCalledWith(groupId, validSig);
    expect(fixture.nativeElement.querySelector('[role="tablist"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="visitor-login-form"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="visitor-group-pin-input"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="public-participants-list"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="private-participants-notice"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent.toLowerCase()).not.toContain('username');

    const goToRegisterBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="visitor-go-to-register-link"]'
    );
    goToRegisterBtn.click();
    fixture.detectChanges();

    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="visitor-register-join-btn"]'
    );
    expect(submitBtn.textContent).toContain('Continuar');

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
        sharePath: `/g/${groupId}`,
        token: 'tok-vis'
      })
    );

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('#vis-name');
    nameInput.value = 'Joãozinho Silva';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.visitorRegisterForm.controls.username.value).toBe('joaozinho.silva');

    component.visitorRegisterForm.controls.pin.setValue('1234');

    const form: HTMLFormElement = fixture.nativeElement.querySelector('[data-testid="visitor-register-form"]');
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(apiMock.joinGroup).toHaveBeenCalledWith(groupId, {
      name: 'Joãozinho Silva',
      username: 'joaozinho.silva',
      pin: '1234',
      inviteSignature: validSig,
      latitude: -23.5505,
      longitude: -46.6333
    });
    expect(authStore.isAuthenticated()).toBe(true);
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
    expect(notice?.textContent).toContain(
      'Este grupo é privado. Para participar, acesse através do link de convite oficial enviado pelo organizador.'
    );
    expect(fixture.nativeElement.querySelector('[data-testid="visitor-login-form"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="authenticated-join-btn"]')).toBeNull();
  });

  it('shows 403 error message when invite link is invalid or rotated during join attempt', async () => {
    apiMock.joinGroup.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' }))
    );

    component.visitorLoginForm.setValue({
      username: 'maria.silva',
      pin: '1234'
    });
    await component.submitVisitorLoginAndJoin();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[data-testid="public-group-error"]');
    expect(alert?.textContent).toContain('Link de convite inválido ou expirado');
  });

  it('displays greeting without @username and sends inviteSignature for non-organizer authenticated user, bypassing signature for organizer', async () => {
    authStore.setSession({
      token: 'tok-auth',
      userId: 'u-55',
      name: 'Pedro Silva',
      username: 'pedro.silva'
    });
    component.group.set({ ...openValidInviteGroupMock, organizer: false, joined: false, inviteValid: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Olá, Pedro Silva. Toque abaixo para confirmar sua participação neste grupo:'
    );
    expect(fixture.nativeElement.textContent).not.toContain('@pedro.silva');
    expect(fixture.nativeElement.querySelector('[data-testid="authenticated-group-pin-input"]')).toBeNull();

    // Organizer bypasses inviteSignature
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
        sharePath: `/g/${groupId}`,
        token: null
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

    // When visible
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

  it('reveals Secret Santa match with valid nome de usuário + PIN and opens EphemeralRevealModalComponent', () => {
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
      pin: '1234'
    });

    const revealFormEl: HTMLFormElement = fixture.nativeElement.querySelector('[data-testid="reveal-form"]');
    revealFormEl.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(apiMock.revealMatch).toHaveBeenCalledWith(groupId, {
      username: 'maria.silva',
      pin: '1234'
    });
    expect(component.revealForm.controls.pin.value).toBe('');
    expect(fixture.nativeElement.querySelector('[data-testid="drawn-participant-name"]')?.textContent).toContain(
      'Lucas Silva'
    );
  });
});
