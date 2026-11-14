import { computed, Injectable, signal } from '@angular/core';

export interface GeoCoordinatesState {
  latitude: number | null;
  longitude: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class DeviceSessionGeoStore {
  private readonly coordinatesSignal = signal<GeoCoordinatesState | null>(null);
  private readonly fallbackNoticeSignal = signal<boolean>(false);

  readonly coordinates = this.coordinatesSignal.asReadonly();
  readonly fallbackNotice = this.fallbackNoticeSignal.asReadonly();
  readonly hasCapturedValidCoordinates = computed(() => {
    const current = this.coordinatesSignal();
    return current !== null && current.latitude !== null && current.longitude !== null;
  });

  saveCapturedCoordinates(latitude: number, longitude: number): void {
    this.coordinatesSignal.set({ latitude, longitude });
    this.fallbackNoticeSignal.set(false);
  }

  recordFallback(): void {
    if (!this.hasCapturedValidCoordinates()) {
      this.coordinatesSignal.set({ latitude: null, longitude: null });
    }
    this.fallbackNoticeSignal.set(true);
  }

  clearDeviceGeo(): void {
    this.coordinatesSignal.set(null);
    this.fallbackNoticeSignal.set(false);
  }
}
