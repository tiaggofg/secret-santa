import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecretSantaApiService } from './secret-santa-api.service';
import { AuthSessionStore } from '../auth/auth-session.store';
import { ShareLinkService } from '../share/share-link.service';

describe('SecretSantaApiService, AuthSessionStore & ShareLinkService', () => {
  let service: SecretSantaApiService;
  let authStore: AuthSessionStore;
  let shareService: ShareLinkService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthSessionStore,
        SecretSantaApiService,
        ShareLinkService
      ]
    });

    service = TestBed.inject(SecretSantaApiService);
    authStore = TestBed.inject(AuthSessionStore);
    shareService = TestBed.inject(ShareLinkService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('stores user session in volatile Signal memory and clears it on switchFamilyUser without touching Web Storage', () => {
    expect(authStore.isAuthenticated()).toBe(false);
    expect(authStore.token()).toBeNull();

    authStore.setSession({
      token: 'jwt-stateless-token',
      userId: '11111111-2222-3333-4444-555555555555',
      name: 'Tiago Godoy',
      username: 'tiago.godoy'
    });

    expect(authStore.isAuthenticated()).toBe(true);
    expect(authStore.token()).toBe('jwt-stateless-token');
    expect(authStore.name()).toBe('Tiago Godoy');
    expect(authStore.username()).toBe('tiago.godoy');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);

    authStore.switchFamilyUser();

    expect(authStore.isAuthenticated()).toBe(false);
    expect(authStore.session()).toBeNull();
    expect(authStore.token()).toBeNull();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('calls POST /api/v1/auth/register and POST /api/v1/auth/login with expected payloads', () => {
    let registerResult: unknown;
    service
      .register({ name: 'Maria Silva', username: 'maria.silva', pin: '1234' })
      .subscribe((res) => (registerResult = res));

    const regReq = httpMock.expectOne('/api/v1/auth/register');
    expect(regReq.request.method).toBe('POST');
    expect(regReq.request.body).toEqual({
      name: 'Maria Silva',
      username: 'maria.silva',
      pin: '1234'
    });
    regReq.flush({
      token: 'tok-1',
      userId: 'u-1',
      name: 'Maria Silva',
      username: 'maria.silva'
    });
    expect(registerResult).toEqual({
      token: 'tok-1',
      userId: 'u-1',
      name: 'Maria Silva',
      username: 'maria.silva'
    });

    let loginResult: unknown;
    service.login({ username: 'maria.silva', pin: '1234' }).subscribe((res) => (loginResult = res));

    const loginReq = httpMock.expectOne('/api/v1/auth/login');
    expect(loginReq.request.method).toBe('POST');
    expect(loginReq.request.body).toEqual({ username: 'maria.silva', pin: '1234' });
    loginReq.flush({
      token: 'tok-2',
      userId: 'u-1',
      name: 'Maria Silva',
      username: 'maria.silva'
    });
    expect(loginResult).toEqual({
      token: 'tok-2',
      userId: 'u-1',
      name: 'Maria Silva',
      username: 'maria.silva'
    });
  });

  it('attaches Authorization Bearer header on authenticated group discovery and creation requests', () => {
    authStore.setSession({
      token: 'secret-bearer-token',
      userId: 'u-1',
      name: 'Maria Silva',
      username: 'maria.silva'
    });

    service.listGroups().subscribe();
    const listReq = httpMock.expectOne('/api/v1/groups');
    expect(listReq.request.method).toBe('GET');
    expect(listReq.request.headers.get('Authorization')).toBe('Bearer secret-bearer-token');
    listReq.flush({ myGroups: [] });

    service.createGroup({ eventName: 'Natal da Família' }).subscribe();
    const createReq = httpMock.expectOne('/api/v1/groups');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.headers.get('Authorization')).toBe('Bearer secret-bearer-token');
    expect(createReq.request.body).toEqual({ eventName: 'Natal da Família' });
    createReq.flush({
      id: '11111111-1111-1111-1111-111111111111',
      eventName: 'Natal da Família',
      organizerUserId: 'u-1',
      status: 'OPEN',
      geographicRestrictionRelaxed: false,
      sharePath: '/g/11111111-1111-1111-1111-111111111111?sig=sig_abc123',
      createdAt: '2026-11-13T18:00:00Z',
      drawnAt: null,
      participants: []
    });
  });

  it('calls getPublicGroup with optional sig query param, joinGroup with inviteSignature, and revealMatch', () => {
    const groupId = '11111111-1111-1111-1111-111111111111';
    authStore.setSession({
      token: 'token-join',
      userId: 'u-2',
      name: 'João Silva',
      username: 'joao.silva'
    });

    service.getPublicGroup(groupId, 'sig_valid_123').subscribe();
    const pubReq = httpMock.expectOne(`/api/v1/groups/${groupId}?sig=sig_valid_123`);
    expect(pubReq.request.method).toBe('GET');
    pubReq.flush({});

    service
      .joinGroup(groupId, {
        inviteSignature: 'sig_valid_123',
        latitude: -23.55,
        longitude: -46.63
      })
      .subscribe();

    const joinReq = httpMock.expectOne(`/api/v1/groups/${groupId}/participants`);
    expect(joinReq.request.method).toBe('POST');
    expect(joinReq.request.headers.get('Authorization')).toBe('Bearer token-join');
    expect(joinReq.request.body).toEqual({
      inviteSignature: 'sig_valid_123',
      latitude: -23.55,
      longitude: -46.63
    });
    joinReq.flush({
      id: 'p-1',
      userId: 'u-2',
      name: 'João Silva',
      username: 'joao.silva',
      hasGeoLocation: true,
      revealStatus: 'WAITING_DRAW',
      createdAt: '2026-11-13T18:05:00Z',
      groupId,
      sharePath: `/g/${groupId}`,
      token: null
    });

    let revealResponse: unknown;
    service
      .revealMatch(groupId, { username: 'joao.silva', pin: '1234' })
      .subscribe((res) => (revealResponse = res));

    const revealReq = httpMock.expectOne(`/api/v1/groups/${groupId}/participants/reveal`);
    expect(revealReq.request.method).toBe('POST');
    expect(revealReq.request.body).toEqual({ username: 'joao.silva', pin: '1234' });
    revealReq.flush({
      participantId: 'p-1',
      username: 'joao.silva',
      drawnParticipantName: 'Maria Silva',
      revealedAt: '2026-11-13T19:00:00Z'
    });
    expect(revealResponse).toEqual({
      participantId: 'p-1',
      username: 'joao.silva',
      drawnParticipantName: 'Maria Silva',
      revealedAt: '2026-11-13T19:00:00Z'
    });
  });

  it('calls admin endpoints (getAdminGroup, rotateInviteLink, removeParticipant, executeDraw, generatePasswordResetToken) and resetPin', () => {
    const groupId = '11111111-1111-1111-1111-111111111111';
    authStore.setSession({
      token: 'org-token',
      userId: 'org-1',
      name: 'Organizador',
      username: 'org.user'
    });

    service.getAdminGroup(groupId).subscribe();
    const adminGet = httpMock.expectOne(`/api/v1/groups/${groupId}/admin`);
    expect(adminGet.request.method).toBe('GET');
    expect(adminGet.request.headers.get('Authorization')).toBe('Bearer org-token');
    adminGet.flush({
      id: groupId,
      eventName: 'Grupo X',
      organizerUserId: 'org-1',
      status: 'OPEN',
      geographicRestrictionRelaxed: false,
      sharePath: `/g/${groupId}?sig=sig_initial`,
      createdAt: '2026-11-13T18:00:00Z',
      drawnAt: null,
      participants: []
    });

    service.rotateInviteLink(groupId).subscribe();
    const rotateReq = httpMock.expectOne(`/api/v1/groups/${groupId}/admin/invite-link/rotate`);
    expect(rotateReq.request.method).toBe('POST');
    expect(rotateReq.request.headers.get('Authorization')).toBe('Bearer org-token');
    rotateReq.flush({
      id: groupId,
      eventName: 'Grupo X',
      organizerUserId: 'org-1',
      status: 'OPEN',
      geographicRestrictionRelaxed: false,
      sharePath: `/g/${groupId}?sig=sig_rotated`,
      createdAt: '2026-11-13T18:00:00Z',
      drawnAt: null,
      participants: []
    });

    service.removeParticipant(groupId, 'part-99').subscribe();
    const delReq = httpMock.expectOne(`/api/v1/groups/${groupId}/admin/participants/part-99`);
    expect(delReq.request.method).toBe('DELETE');
    expect(delReq.request.headers.get('Authorization')).toBe('Bearer org-token');
    delReq.flush(null);

    service.executeDraw(groupId).subscribe();
    const drawReq = httpMock.expectOne(`/api/v1/groups/${groupId}/admin/draw`);
    expect(drawReq.request.method).toBe('POST');
    expect(drawReq.request.headers.get('Authorization')).toBe('Bearer org-token');
    drawReq.flush({});

    service.generatePasswordResetToken(groupId, 'part-99').subscribe();
    const resetTokReq = httpMock.expectOne(`/api/v1/groups/${groupId}/admin/participants/part-99/reset-token`);
    expect(resetTokReq.request.method).toBe('POST');
    expect(resetTokReq.request.headers.get('Authorization')).toBe('Bearer org-token');
    resetTokReq.flush({
      participantId: 'part-99',
      userId: 'u-99',
      username: 'dependente',
      resetToken: 'tok-reset-123',
      resetPath: '/reset/tok-reset-123',
      expiresAt: '2026-11-14T18:00:00Z'
    });

    service.resetPin({ token: 'tok-reset-123', newPin: '5678' }).subscribe();
    const resetPinReq = httpMock.expectOne('/api/v1/auth/reset-pin');
    expect(resetPinReq.request.method).toBe('POST');
    expect(resetPinReq.request.body).toEqual({ token: 'tok-reset-123', newPin: '5678' });
    resetPinReq.flush({
      userId: 'u-99',
      username: 'dependente',
      message: 'PIN updated successfully'
    });
  });

  it('ShareLinkService copies full WhatsApp message + opens wa.me on desktop fallback and copies only URL on copyUrl', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const shareRes = await shareService.shareLink({
      title: 'Amigo Secreto: Natal Família',
      text: 'Participe do grupo de amigo secreto "Natal Família" clicando no link abaixo:',
      pathOrUrl: '/g/123?sig=abc',
      openWhatsAppFallback: true
    });

    const expectedUrl = `${window.location.origin}/g/123?sig=abc`;
    const expectedMessage = `Participe do grupo de amigo secreto "Natal Família" clicando no link abaixo:\n${expectedUrl}`;

    expect(shareRes.method).toBe('clipboard');
    expect(writeTextSpy).toHaveBeenCalledWith(expectedMessage);
    expect(openSpy).toHaveBeenCalledWith(
      `https://wa.me/?text=${encodeURIComponent(expectedMessage)}`,
      '_blank',
      'noopener,noreferrer'
    );

    writeTextSpy.mockClear();
    const copyRes = await shareService.copyUrl('/g/123?sig=abc');
    expect(copyRes.method).toBe('clipboard');
    expect(writeTextSpy).toHaveBeenCalledWith(expectedUrl);

    openSpy.mockRestore();
  });
});
