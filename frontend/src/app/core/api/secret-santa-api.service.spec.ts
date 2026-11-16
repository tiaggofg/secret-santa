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

  it('stores user session in volatile Signal memory without tokens and clears it on switchFamilyUser without touching Web Storage', () => {
    expect(authStore.isAuthenticated()).toBe(false);

    authStore.setSession({
      userId: '11111111-2222-3333-4444-555555555555',
      name: 'Tiago Godoy',
      username: 'tiago.godoy'
    });

    expect(authStore.isAuthenticated()).toBe(true);
    expect(authStore.name()).toBe('Tiago Godoy');
    expect(authStore.username()).toBe('tiago.godoy');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);

    authStore.switchFamilyUser();

    expect(authStore.isAuthenticated()).toBe(false);
    expect(authStore.session()).toBeNull();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('calls auth endpoints (register, login, me, refresh, logout) with expected payloads', () => {
    let registerResult: unknown;
    service
      .register({ name: 'Maria Silva', username: 'maria.silva', password: 'Natal@2026' })
      .subscribe((res) => (registerResult = res));

    const regReq = httpMock.expectOne('/api/v1/auth/register');
    expect(regReq.request.method).toBe('POST');
    expect(regReq.request.body).toEqual({
      name: 'Maria Silva',
      username: 'maria.silva',
      password: 'Natal@2026'
    });
    regReq.flush({
      userId: 'u-1',
      name: 'Maria Silva',
      username: 'maria.silva'
    });
    expect(registerResult).toEqual({
      userId: 'u-1',
      name: 'Maria Silva',
      username: 'maria.silva'
    });

    let loginResult: unknown;
    service.login({ username: 'maria.silva', password: 'Natal@2026' }).subscribe((res) => (loginResult = res));

    const loginReq = httpMock.expectOne('/api/v1/auth/login');
    expect(loginReq.request.method).toBe('POST');
    expect(loginReq.request.body).toEqual({ username: 'maria.silva', password: 'Natal@2026' });
    loginReq.flush({
      userId: 'u-1',
      name: 'Maria Silva',
      username: 'maria.silva'
    });
    expect(loginResult).toEqual({
      userId: 'u-1',
      name: 'Maria Silva',
      username: 'maria.silva'
    });

    service.me().subscribe();
    const meReq = httpMock.expectOne('/api/v1/auth/me');
    expect(meReq.request.method).toBe('GET');
    meReq.flush({ userId: 'u-1', name: 'Maria Silva', username: 'maria.silva' });

    service.refresh().subscribe();
    const refreshReq = httpMock.expectOne('/api/v1/auth/refresh');
    expect(refreshReq.request.method).toBe('POST');
    refreshReq.flush({ userId: 'u-1', name: 'Maria Silva', username: 'maria.silva' });

    service.logout().subscribe();
    const logoutReq = httpMock.expectOne('/api/v1/auth/logout');
    expect(logoutReq.request.method).toBe('POST');
    logoutReq.flush(null);
  });

  it('calls group discovery and creation endpoints without Authorization Bearer header', () => {
    service.listGroups().subscribe();
    const listReq = httpMock.expectOne('/api/v1/groups');
    expect(listReq.request.method).toBe('GET');
    expect(listReq.request.headers.has('Authorization')).toBe(false);
    listReq.flush({ myGroups: [] });

    service.createGroup({ eventName: 'Natal da Família' }).subscribe();
    const createReq = httpMock.expectOne('/api/v1/groups');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.headers.has('Authorization')).toBe(false);
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
      sharePath: `/g/${groupId}`
    });

    let revealResponse: unknown;
    service
      .revealMatch(groupId, { username: 'joao.silva', password: 'Natal@2026' })
      .subscribe((res) => (revealResponse = res));

    const revealReq = httpMock.expectOne(`/api/v1/groups/${groupId}/participants/reveal`);
    expect(revealReq.request.method).toBe('POST');
    expect(revealReq.request.body).toEqual({ username: 'joao.silva', password: 'Natal@2026' });
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

  it('calls admin endpoints and resetPassword', () => {
    const groupId = '11111111-1111-1111-1111-111111111111';

    service.getAdminGroup(groupId).subscribe();
    const adminGet = httpMock.expectOne(`/api/v1/groups/${groupId}/admin`);
    expect(adminGet.request.method).toBe('GET');
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
    rotateReq.flush({});

    service.removeParticipant(groupId, 'part-99').subscribe();
    const delReq = httpMock.expectOne(`/api/v1/groups/${groupId}/admin/participants/part-99`);
    expect(delReq.request.method).toBe('DELETE');
    delReq.flush(null);

    service.executeDraw(groupId).subscribe();
    const drawReq = httpMock.expectOne(`/api/v1/groups/${groupId}/admin/draw`);
    expect(drawReq.request.method).toBe('POST');
    drawReq.flush({});

    service.generatePasswordResetToken(groupId, 'part-99').subscribe();
    const resetTokReq = httpMock.expectOne(`/api/v1/groups/${groupId}/admin/participants/part-99/reset-token`);
    expect(resetTokReq.request.method).toBe('POST');
    resetTokReq.flush({});

    service.resetPassword({ token: 'tok-reset-123', newPassword: 'Nova@2026' }).subscribe();
    const resetPasswordReq = httpMock.expectOne('/api/v1/auth/reset-password');
    expect(resetPasswordReq.request.method).toBe('POST');
    expect(resetPasswordReq.request.body).toEqual({ token: 'tok-reset-123', newPassword: 'Nova@2026' });
    resetPasswordReq.flush({
      userId: 'u-99',
      username: 'dependente',
      message: 'Password updated successfully'
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
    const expectedMessage = `Participe do grupo de amigo secreto "Natal Família" clicando no link abaixo:\n\n${expectedUrl}`;

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
