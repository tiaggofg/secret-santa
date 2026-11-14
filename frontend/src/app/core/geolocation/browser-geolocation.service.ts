import { inject, Injectable } from '@angular/core';
import { DeviceSessionGeoStore, GeoCoordinatesState } from './device-session-geo.store';

export interface GeolocationCaptureResult extends GeoCoordinatesState {
  fallbackUsed: boolean;
  reusedFromSession: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class BrowserGeolocationService {
  static readonly GEO_TIMEOUT_MS = 8000;

  private readonly geoStore = inject(DeviceSessionGeoStore);

  async captureCoordinatesForJoin(): Promise<GeolocationCaptureResult> {
    const existing = this.geoStore.coordinates();
    if (existing && existing.latitude !== null && existing.longitude !== null) {
      return {
        latitude: existing.latitude,
        longitude: existing.longitude,
        fallbackUsed: false,
        reusedFromSession: true
      };
    }

    const geolocation = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
      this.geoStore.recordFallback();
      return {
        latitude: null,
        longitude: null,
        fallbackUsed: true,
        reusedFromSession: false
      };
    }

    return new Promise<GeolocationCaptureResult>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        this.geoStore.recordFallback();
        resolve({
          latitude: null,
          longitude: null,
          fallbackUsed: true,
          reusedFromSession: false
        });
      }, BrowserGeolocationService.GEO_TIMEOUT_MS);

      try {
        geolocation.getCurrentPosition(
          (position) => {
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(timer);
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            if (
              typeof lat === 'number' &&
              typeof lng === 'number' &&
              !Number.isNaN(lat) &&
              !Number.isNaN(lng)
            ) {
              this.geoStore.saveCapturedCoordinates(lat, lng);
              resolve({
                latitude: lat,
                longitude: lng,
                fallbackUsed: false,
                reusedFromSession: false
              });
            } else {
              this.geoStore.recordFallback();
              resolve({
                latitude: null,
                longitude: null,
                fallbackUsed: true,
                reusedFromSession: false
              });
            }
          },
          () => {
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(timer);
            this.geoStore.recordFallback();
            resolve({
              latitude: null,
              longitude: null,
              fallbackUsed: true,
              reusedFromSession: false
            });
          },
          {
            enableHighAccuracy: true,
            timeout: BrowserGeolocationService.GEO_TIMEOUT_MS,
            maximumAge: 60000
          }
        );
      } catch {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          this.geoStore.recordFallback();
          resolve({
            latitude: null,
            longitude: null,
            fallbackUsed: true,
            reusedFromSession: false
          });
        }
      }
    });
  }
}
