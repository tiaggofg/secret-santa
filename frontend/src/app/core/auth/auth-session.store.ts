import { computed, Injectable, signal } from '@angular/core';
import { AuthSessionView } from '../api/secret-santa-api.models';

@Injectable({
  providedIn: 'root'
})
export class AuthSessionStore {
  private readonly sessionSignal = signal<AuthSessionView | null>(null);

  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);
  readonly token = computed(() => this.sessionSignal()?.token ?? null);
  readonly userId = computed(() => this.sessionSignal()?.userId ?? null);
  readonly name = computed(() => this.sessionSignal()?.name ?? null);
  readonly username = computed(() => this.sessionSignal()?.username ?? null);

  setSession(session: AuthSessionView): void {
    this.sessionSignal.set({
      token: session.token,
      userId: session.userId,
      name: session.name,
      username: session.username
    });
  }

  /**
   * Clears the active user session in volatile memory so another family member
   * (e.g. child/dependent) can register or log in on the same device.
   * Never writes to or reads from localStorage/sessionStorage.
   */
  switchFamilyUser(): void {
    this.sessionSignal.set(null);
  }

  clear(): void {
    this.sessionSignal.set(null);
  }
}
