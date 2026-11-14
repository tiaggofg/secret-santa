import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  signal
} from '@angular/core';

@Component({
  selector: 'app-ephemeral-reveal-modal',
  standalone: true,
  template: `
    @if (drawnName(); as secretFriend) {
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reveal-modal-title"
        data-testid="ephemeral-reveal-backdrop"
        class="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4"
      >
        <div
          data-testid="ephemeral-reveal-card"
          class="w-full max-w-sm bg-white border-4 border-emerald-600 rounded-3xl p-6 shadow-2xl text-center space-y-5"
        >
          <div class="space-y-1">
            <p
              id="reveal-modal-title"
              class="text-xs font-extrabold uppercase tracking-widest text-emerald-800"
            >
              Seu Amigo Secreto é
            </p>
            @if (participantUsername()) {
              <p class="text-xs text-slate-500">Consulta exclusiva de &#64;{{ participantUsername() }}</p>
            }
          </div>

          <div
            data-testid="drawn-participant-name"
            class="py-6 px-4 rounded-2xl bg-emerald-950 text-white font-black text-3xl tracking-tight break-words shadow-inner"
          >
            {{ secretFriend }}
          </div>

          <p class="text-xs text-slate-600 leading-relaxed">
            Memorize o nome acima! Ao tocar no botão abaixo ou bloquear a tela, este resultado será apagado imediatamente da memória do celular.
          </p>

          <button
            type="button"
            data-testid="close-and-pass-phone-btn"
            (click)="wipeAndClose()"
            class="w-full min-h-12 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-extrabold text-base px-4 py-3.5 shadow-md transition"
          >
            Fechar e passar o celular
          </button>
        </div>
      </div>
    }
  `
})
export class EphemeralRevealModalComponent implements OnDestroy {
  readonly drawnName = signal<string | null>(null);
  readonly participantUsername = signal<string | null>(null);

  @Input()
  set drawnParticipantName(value: string | null) {
    this.drawnName.set(value);
  }

  @Input()
  set username(value: string | null) {
    this.participantUsername.set(value);
  }

  @Output()
  readonly closed = new EventEmitter<void>();

  @HostListener('document:visibilitychange')
  onDocumentVisibilityChange(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.wipeAndClose();
    }
  }

  open(name: string, username?: string): void {
    this.drawnName.set(name);
    this.participantUsername.set(username ?? null);
  }

  wipeAndClose(): void {
    const hadValue = this.drawnName() !== null;
    this.drawnName.set(null);
    this.participantUsername.set(null);
    if (hadValue) {
      this.closed.emit();
    }
  }

  ngOnDestroy(): void {
    this.drawnName.set(null);
    this.participantUsername.set(null);
  }
}
