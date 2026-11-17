import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  signal
} from '@angular/core';
import { FestiveIconComponent } from '../../shared/components/festive-icon.component';

@Component({
  selector: 'app-ephemeral-reveal-modal',
  standalone: true,
  imports: [FestiveIconComponent],
  template: `
    @if (drawnName(); as secretFriend) {
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reveal-modal-title"
        data-testid="ephemeral-reveal-backdrop"
        class="fixed inset-0 z-50 bg-pine-950/95 backdrop-blur-sm flex p-4 overflow-y-auto"
      >
        <div
          data-testid="ephemeral-reveal-card"
          class="m-auto w-full max-w-sm bg-festive-cream border-2 border-gold-500 rounded-3xl overflow-hidden shadow-2xl text-center animate-fade-slide-up"
        >
          <!-- Cranberry & Gold Gift Ribbon Header -->
          <div class="bg-gradient-to-r from-cranberry-800 via-cranberry-700 to-cranberry-800 px-5 py-4 text-white relative border-b-2 border-gold-400">
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/15 border border-gold-400/70 mb-2 shadow-inner">
              <app-festive-icon name="gift-open" svgClass="w-6 h-6 text-amber-200" />
            </div>
            <p
              id="reveal-modal-title"
              class="text-xs font-extrabold uppercase tracking-widest text-amber-100"
            >
              Seu Amigo Secreto é
            </p>
            @if (participantUsername()) {
              <p class="text-xs text-amber-200/90 mt-0.5">
                Consulta exclusiva de &#64;{{ participantUsername() }}
              </p>
            }
          </div>

          <div class="p-6 space-y-5">
            <!-- High-contrast name box (>= 7:1 contrast) -->
            <div
              data-testid="drawn-participant-name"
              class="py-7 px-4 rounded-2xl bg-pine-900 border-2 border-gold-500 text-white font-display font-bold text-3xl sm:text-4xl tracking-tight break-words shadow-inner"
            >
              {{ secretFriend }}
            </div>

            <!-- Secret privacy shield notice -->
            <div class="flex items-start gap-2.5 text-left rounded-xl bg-gold-50 border border-gold-200 p-3 text-xs text-ink-900 leading-relaxed">
              <app-festive-icon name="shield-eye" svgClass="w-5 h-5 text-gold-600 shrink-0 mt-0.5" />
              <p>
                <strong>Sigilo de Natal:</strong> o nome some da tela assim que você fechar ou sair. Você pode consultá-lo novamente a qualquer momento usando sua senha.
              </p>
            </div>

            <button
              type="button"
              data-testid="close-and-pass-phone-btn"
              (click)="wipeAndClose()"
              class="w-full min-h-[52px] rounded-2xl bg-pine-800 hover:bg-pine-900 active:bg-pine-950 text-white font-extrabold text-base px-4 py-3.5 shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              Fechar
            </button>
          </div>
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
    this.syncBodyScrollLock(value !== null);
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
    this.syncBodyScrollLock(true);
  }

  wipeAndClose(): void {
    const hadValue = this.drawnName() !== null;
    this.drawnName.set(null);
    this.participantUsername.set(null);
    this.syncBodyScrollLock(false);
    if (hadValue) {
      this.closed.emit();
    }
  }

  ngOnDestroy(): void {
    this.drawnName.set(null);
    this.participantUsername.set(null);
    this.syncBodyScrollLock(false);
  }

  private syncBodyScrollLock(locked: boolean): void {
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = locked ? 'hidden' : '';
    }
  }
}
