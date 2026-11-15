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

  const openHiddenParticipantsGroupMock: PublicGroupView = {
    id: groupId,
    eventName: 'Natal Família Silva',
    organizerUserId: 'org-1',
    status: 'OPEN',
    geographicRestrictionRelaxed: false,
    sharePath: `/g/${groupId}`,
    organizer: false,
    joined: false,
    participantsVisible: false,
    participantCount: 1,
    createdAt: '2026-11-13T18:00:00Z',
    drawnAt: null,
    participants: []
  };

  const drawnVisibleGroupMock: PublicGroupView = {
    ...openHiddenParticipantsGroupMock,
    status: 'DRAWN',
    joined: true,
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
    apiMock.getPublicGroup.mockReturnValue(of(openHiddenParticipantsGroupMock));
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
              paramMap: convertToParamMap({ groupId })
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

  it('opens on visitor login without tablist, hides participant list for non-members and switches to inline register with Continuar button', async () => {
    expect(fixture.nativeElement.querySelector('[role="tablist"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="visitor-login-form"]')).not.toBeNull();
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
    component.visitorRegisterForm.controls.groupPin.setValue('5678');

    const form: HTMLFormElement = fixture.nativeElement.querySelector('[data-testid="visitor-register-form"]');
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(apiMock.joinGroup).toHaveBeenCalledWith(groupId, {
      name: 'Joãozinho Silva',
      username: 'joaozinho.silva',
      pin: '1234',
      groupPin: '5678',
      latitude: -23.5505,
      longitude: -46.6333
    });
    expect(authStore.isAuthenticated()).toBe(true);
  });

  it('shows 403 error message when visitor enters wrong groupPin', async () => {
    apiMock.joinGroup.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' }))
    );

    component.visitorLoginForm.setValue({
      username: 'maria.silva',
      pin: '1234',
      groupPin: '0000'
    });
    await component.submitVisitorLoginAndJoin();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[data-testid="public-group-error"]');
    expect(alert?.textContent).toContain('PIN do grupo incorreto');
  });

  it('displays greeting without @username and requires groupPin for non-organizer authenticated user, but bypasses groupPin for organizer', async () => {
    authStore.setSession({
      token: 'tok-auth',
      userId: 'u-55',
      name: 'Pedro Silva',
      username: 'pedro.silva'
    });
    component.group.set({ ...openHiddenParticipantsGroupMock, organizer: false, joined: false });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Olá, Pedro Silva. Toque abaixo para confirmar sua participação neste grupo:'
    );
    expect(fixture.nativeElement.textContent).not.toContain('@pedro.silva');
    expect(fixture.nativeElement.querySelector('[data-testid="public-switch-family-user-btn"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="authenticated-group-pin-input"]')).not.toBeNull();

    // Organizer bypasses groupPin
    component.group.set({ ...openHiddenParticipantsGroupMock, organizer: true, joined: false });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="authenticated-group-pin-input"]')).toBeNull();

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
      groupPin: undefined,
      latitude: -23.5505,
      longitude: -46.6333
    });
  });

  it('displays reveal form even when participants are hidden in DRAWN state, and pre-fills when visible', () => {
    apiMock.getPublicGroup.mockReturnValue(
      of({
        ...openHiddenParticipantsGroupMock,
        status: 'DRAWN',
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
