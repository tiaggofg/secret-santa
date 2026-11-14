import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserGeolocationService } from './browser-geolocation.service';
import { DeviceSessionGeoStore } from './device-session-geo.store';
import { AuthSessionStore } from '../auth/auth-session.store';
import { ShareLinkService } from '../share/share-link.service';

describe('BrowserGeolocationService', () => {
  let geoService: BrowserGeolocationService;
  let geoStore: DeviceSessionGeoStore;
  let authStore: AuthSessionStore;
  let shareService: ShareLinkService;

  const originalGeolocation = navigator.geolocation;
  const originalShare = navigator.share;
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BrowserGeolocationService,
        DeviceSessionGeoStore,
        AuthSessionStore,
        ShareLinkService
      ]
    });

    geoService = TestBed.inject(BrowserGeolocationService);
    geoStore = TestBed.inject(DeviceSessionGeoStore);
    authStore = TestBed.inject(AuthSessionStore);
    shareService = TestBed.inject(ShareLinkService);
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, 'geolocation', {
      value: originalGeolocation,
      configurable: true,
      writable: true
    });
    Object.defineProperty(navigator, 'share', {
      value: originalShare,
      configurable: true,
      writable: true
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true
    });
  });

  it('requests navigator.geolocation.getCurrentPosition with 8000ms timeout and returns valid coordinates when granted', async () => {
    const getCurrentPositionMock = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: -23.420999,
          longitude: -51.933056,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({})
        },
        timestamp: Date.now(),
        toJSON: () => ({})
      });
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true
    });

    const result = await geoService.captureCoordinatesForJoin();

    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1);
    const options = getCurrentPositionMock.mock.calls[0][2] as PositionOptions;
    expect(options.timeout).toBe(8000);
    expect(result).toEqual({
      latitude: -23.420999,
      longitude: -51.933056,
      fallbackUsed: false,
      reusedFromSession: false
    });
    expect(geoStore.hasCapturedValidCoordinates()).toBe(true);
    expect(geoStore.fallbackNotice()).toBe(false);
  });

  it('returns null coordinates and sets fallbackNotice when GPS permission is denied', async () => {
    const getCurrentPositionMock = vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
      error?.({
        code: 1,
        message: 'User denied Geolocation',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3
      });
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true
    });

    const result = await geoService.captureCoordinatesForJoin();

    expect(result).toEqual({
      latitude: null,
      longitude: null,
      fallbackUsed: true,
      reusedFromSession: false
    });
    expect(geoStore.fallbackNotice()).toBe(true);
  });

  it('falls back to null coordinates after 8000ms timeout when browser geolocation hangs', async () => {
    vi.useFakeTimers();

    const getCurrentPositionMock = vi.fn(() => {
      // Never resolves
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true
    });

    const promise = geoService.captureCoordinatesForJoin();
    vi.advanceTimersByTime(8000);
    const result = await promise;

    expect(result).toEqual({
      latitude: null,
      longitude: null,
      fallbackUsed: true,
      reusedFromSession: false
    });
    expect(geoStore.fallbackNotice()).toBe(true);
  });

  it('falls back gracefully when navigator.geolocation is unavailable (e.g. insecure HTTP context)', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: undefined,
      configurable: true
    });

    const result = await geoService.captureCoordinatesForJoin();

    expect(result).toEqual({
      latitude: null,
      longitude: null,
      fallbackUsed: true,
      reusedFromSession: false
    });
    expect(geoStore.fallbackNotice()).toBe(true);
  });

  it('reuses captured coordinates in DeviceSessionGeoStore after AuthSessionStore.switchFamilyUser() without prompting again', async () => {
    const getCurrentPositionMock = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: -23.55052,
          longitude: -46.633308,
          accuracy: 12,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({})
        },
        timestamp: Date.now(),
        toJSON: () => ({})
      });
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true
    });

    authStore.setSession({
      token: 'parent-token',
      userId: 'parent-id',
      name: 'Pai',
      username: 'pai.silva'
    });

    const firstCapture = await geoService.captureCoordinatesForJoin();
    expect(firstCapture.reusedFromSession).toBe(false);
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1);

    // Switch family user on the same device to register child/dependent
    authStore.switchFamilyUser();
    expect(authStore.isAuthenticated()).toBe(false);
    expect(geoStore.hasCapturedValidCoordinates()).toBe(true);

    const dependentCapture = await geoService.captureCoordinatesForJoin();
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1);
    expect(dependentCapture).toEqual({
      latitude: -23.55052,
      longitude: -46.633308,
      fallbackUsed: false,
      reusedFromSession: true
    });
  });

  it('invokes navigator.share when supported or falls back to navigator.clipboard.writeText for group and reset links', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: shareMock,
      configurable: true
    });

    const shareRes = await shareService.shareLink({
      title: 'Natal da Família',
      text: 'Entre no Amigo Secreto!',
      pathOrUrl: '/g/natal-familia-a1b2'
    });

    expect(shareRes.method).toBe('web-share');
    expect(shareRes.url).toContain('/g/natal-familia-a1b2');
    expect(shareMock).toHaveBeenCalledWith({
      title: 'Natal da Família',
      text: 'Entre no Amigo Secreto!',
      url: shareRes.url
    });

    // Now test fallback to clipboard when navigator.share is unavailable
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true
    });
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true
    });

    const resetShareRes = await shareService.shareLink({
      title: 'Redefinir PIN',
      pathOrUrl: '/reset/tok-abc-123'
    });

    expect(resetShareRes.method).toBe('clipboard');
    expect(resetShareRes.url).toContain('/reset/tok-abc-123');
    expect(writeTextMock).toHaveBeenCalledWith(resetShareRes.url);
  });
});
