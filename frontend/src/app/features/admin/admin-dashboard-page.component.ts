import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';
import {
  AdminGroupView,
  AdminParticipantView,
  PasswordResetLinkView
} from '../../core/api/secret-santa-api.models';
import { ShareLinkService } from '../../core/share/share-link.service';
import { FestiveIconComponent } from '../../shared/components/festive-icon.component';
import { formatParticipantCount, getAvatarTone, getInitials } from '../../shared/formatters';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [RouterLink, FestiveIconComponent],
  template: `
    <div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <a
          routerLink="/"
          class="min-h-11 text-sm font-semibold text-pine-800 hover:underline inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg px-1"
        >
          ← Voltar para Meus Grupos
        </a>
        @if (group(); as g) {
          <a
            [routerLink]="['/g', g.id]"
            data-testid="view-public-group-link"
            class="min-h-11 text-sm font-semibold text-ink-900 hover:underline inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg px-1"
          >
            Página Pública →
          </a>
        }
      </div>

      @if (errorMessage()) {
        <div
          role="alert"
          data-testid="admin-error"
          class="rounded-2xl bg-cranberry-50 border border-cranberry-200 p-4 text-sm text-cranberry-800 font-medium break-words"
        >
          {{ errorMessage() }}
        </div>
      }

      @if (group(); as g) {
        <!-- Card 1: Cabeçalho & Resumo / Ação Principal de Estado -->
        <section
          data-testid="admin-summary-card"
          class="bg-festive-card border border-festive-border rounded-3xl p-5 shadow-sm space-y-4"
        >
          <div class="space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gold-600 whitespace-nowrap">
                <app-festive-icon name="star" svgClass="w-3.5 h-3.5" />
                Painel do Organizador
              </span>
              <span
                data-testid="group-status-badge"
                [attr.data-group-status]="g.status"
                [class]="
                  g.status === 'DRAWN'
                    ? 'px-2.5 py-0.5 rounded-full bg-cranberry-50 border border-cranberry-200 text-cranberry-800 text-[11px] font-bold shrink-0 whitespace-nowrap'
                    : 'px-2.5 py-0.5 rounded-full bg-gold-100 border border-gold-200 text-gold-900 text-[11px] font-bold shrink-0 whitespace-nowrap'
                "
              >
                {{ g.status === 'DRAWN' ? 'Sorteio Realizado' : 'Inscrições Abertas' }}
              </span>
            </div>

            <h1 class="font-display text-2xl font-bold text-ink-900 break-words leading-tight w-full">
              {{ g.eventName }}
            </h1>
          </div>

          @if (g.status === 'OPEN') {
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-festive-cream border border-festive-border text-xs font-semibold text-ink-900 tabular-nums">
                {{ participantCountLabel(g.participants.length) }}
              </span>
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pine-50 border border-pine-200 text-xs font-semibold text-pine-900 tabular-nums">
                <app-festive-icon name="gps" svgClass="w-3.5 h-3.5 text-pine-800" />
                {{ geoProtectedCount() }} com proteção GPS 50m
              </span>
            </div>

            <div class="pt-3 border-t border-festive-border space-y-3">
              @if (!canExecuteDraw()) {
                <p data-testid="min-participants-hint" class="text-xs text-ink-600 leading-relaxed">
                  {{ missingParticipantsHint(g.participants.length) }}
                </p>
              }

              @if (!confirmDrawPending()) {
                <button
                  type="button"
                  data-testid="execute-draw-btn"
                  [disabled]="!canExecuteDraw() || isBusy()"
                  (click)="confirmDrawPending.set(true)"
                  class="w-full min-h-12 rounded-xl bg-cranberry-700 hover:bg-cranberry-800 disabled:opacity-40 text-white font-bold text-base px-4 py-3 shadow-sm transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <app-festive-icon name="gift" svgClass="w-5 h-5" />
                  <span>Realizar Sorteio Agora</span>
                </button>
              } @else {
                <div class="rounded-2xl bg-cranberry-50 border-2 border-cranberry-200 p-4 space-y-3 animate-fade-slide-up">
                  <p class="text-sm font-bold text-cranberry-800">
                    Confirmar realização do sorteio?
                  </p>
                  <p class="text-xs text-ink-900 leading-relaxed">
                    Esta ação é definitiva: após o sorteio, não será mais possível adicionar ou remover participantes deste grupo.
                  </p>
                  <div class="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      data-testid="confirm-draw-btn"
                      [disabled]="isBusy()"
                      (click)="onExecuteDraw()"
                      class="flex-1 min-h-12 rounded-xl bg-cranberry-700 hover:bg-cranberry-800 disabled:opacity-60 text-white font-bold text-sm px-4 py-2.5 shadow-sm transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    >
                      @if (isBusy()) {
                        <app-festive-icon name="spinner" svgClass="w-4 h-4" />
                        <span>Sorteando...</span>
                      } @else {
                        <span>Sim, Sortear Agora!</span>
                      }
                    </button>
                    <button
                      type="button"
                      [disabled]="isBusy()"
                      (click)="confirmDrawPending.set(false)"
                      class="min-h-12 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-ink-900 font-semibold text-sm px-4 py-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <!-- Estado DRAWN: Progresso de Revelação & Atalho -->
            <div class="space-y-3">
              <div class="rounded-2xl bg-festive-cream border border-festive-border p-3.5 space-y-2">
                <div class="flex items-center justify-between gap-2 text-xs font-bold text-ink-900">
                  <span data-testid="reveal-progress-label" class="inline-flex items-center gap-1.5 text-pine-900">
                    <app-festive-icon name="gift-open" svgClass="w-4 h-4 text-cranberry-700" />
                    <span class="tabular-nums">{{ revealedCount() }} de {{ g.participants.length }} já descobriram</span>
                  </span>
                  <span class="tabular-nums text-ink-600">{{ revealProgressPercent() }}%</span>
                </div>
                <div
                  class="w-full h-2.5 rounded-full bg-white border border-festive-border overflow-hidden"
                  role="progressbar"
                  aria-label="Progresso de revelação do sorteio"
                  [attr.aria-valuenow]="revealedCount()"
                  aria-valuemin="0"
                  [attr.aria-valuemax]="g.participants.length"
                >
                  <div
                    data-testid="reveal-progress-bar"
                    class="h-full rounded-full bg-pine-700 transition-all duration-300"
                    [style.width.%]="revealProgressPercent()"
                  ></div>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pine-50 border border-pine-200 text-xs font-semibold text-pine-900 tabular-nums">
                  <app-festive-icon name="gps" svgClass="w-3.5 h-3.5 text-pine-800" />
                  {{ geoProtectedCount() }} com proteção GPS 50m
                </span>
              </div>

              @if (g.geographicRestrictionRelaxed) {
                <div
                  data-testid="geo-relaxed-badge"
                  class="rounded-2xl bg-gold-50 border border-gold-200 p-3 text-xs text-gold-950 break-words leading-relaxed"
                >
                  Nota do sorteio: mais de 50% dos inscritos estavam na mesma residência, portanto o relaxamento geográfico automático foi acionado para garantir que todos participassem.
                </div>
              }

              <a
                [routerLink]="['/g', g.id]"
                data-testid="open-reveal-page-link"
                class="w-full min-h-12 rounded-xl bg-pine-800 hover:bg-pine-900 text-white font-bold text-sm px-4 py-3 shadow-sm transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <app-festive-icon name="gift-open" svgClass="w-4 h-4" />
                <span>Abrir Página de Revelação</span>
              </a>
            </div>
          }
        </section>

        <!-- Card 2: Convite da Família (Exclusivo do estado OPEN) -->
        @if (g.status === 'OPEN') {
          <section
            data-testid="invite-card"
            class="bg-festive-card border border-festive-border rounded-3xl p-5 shadow-sm space-y-3.5"
          >
            <div class="space-y-0.5">
              <h2 class="font-display text-lg font-bold text-ink-900">
                Convidar Participantes
              </h2>
              <p class="text-xs text-ink-600">
                Envie o convite privado pelo WhatsApp ou copie o link.
              </p>
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="share-group-link-btn"
                (click)="shareGroupInviteLink(g)"
                class="flex-1 min-w-[190px] min-h-12 rounded-xl bg-pine-800 hover:bg-pine-900 text-white font-bold text-sm px-4 py-3 shadow-sm transition inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <app-festive-icon name="share" svgClass="w-4 h-4" />
                <span>Convidar pelo WhatsApp</span>
              </button>

              <button
                type="button"
                data-testid="copy-group-link-btn"
                (click)="copyGroupPath(g)"
                class="flex-1 sm:flex-none min-w-[130px] min-h-12 rounded-xl bg-festive-cream hover:bg-stone-200/70 border border-festive-border text-ink-900 font-semibold text-sm px-4 py-3 transition inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <app-festive-icon [name]="copiedInviteLink() ? 'check' : 'copy'" svgClass="w-4 h-4 text-pine-800" />
                <span>{{ copiedInviteLink() ? 'Copiado!' : 'Copiar Link' }}</span>
              </button>
            </div>

            <div class="pt-2 border-t border-festive-border">
              @if (!confirmRotateInvitePending()) {
                <div class="flex justify-end">
                  <button
                    type="button"
                    data-testid="rotate-invite-link-btn"
                    [disabled]="isBusy()"
                    (click)="confirmRotateInvitePending.set(true)"
                    class="min-h-11 px-3 rounded-xl text-xs font-semibold text-ink-600 hover:text-pine-900 hover:bg-festive-cream border border-transparent hover:border-festive-border inline-flex items-center gap-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    <app-festive-icon name="key" svgClass="w-3.5 h-3.5 text-gold-600" />
                    <span>Gerar Novo Link de Convite</span>
                  </button>
                </div>
              } @else {
                <div
                  data-testid="rotate-invite-confirm"
                  class="rounded-2xl bg-gold-50 border border-gold-200 p-3.5 space-y-2.5 animate-fade-slide-up"
                >
                  <p class="text-xs font-bold text-gold-950 leading-relaxed">
                    Isso invalidará o link anterior. Gerar novo link?
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="confirm-rotate-invite-btn"
                      [disabled]="isBusy()"
                      (click)="onRotateInviteLink()"
                      class="flex-1 min-h-11 rounded-xl bg-gold-800 hover:bg-gold-900 disabled:opacity-60 text-white font-bold text-xs px-4 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      data-testid="cancel-rotate-invite-btn"
                      [disabled]="isBusy()"
                      (click)="confirmRotateInvitePending.set(false)"
                      class="min-h-11 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-ink-900 font-semibold text-xs px-4 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              }
            </div>
          </section>
        }

        @if (activeResetLink(); as resetInfo) {
          <section
            data-testid="generated-reset-link-card"
            class="bg-gold-50 border border-gold-300 rounded-3xl p-4 sm:p-5 space-y-3 shadow-sm animate-fade-slide-up"
          >
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <span class="px-2.5 py-0.5 rounded-full bg-gold-100 border border-gold-200 text-gold-900 text-[11px] font-bold">
                  Uso único • Válido por 24h
                </span>
                <button
                  type="button"
                  data-testid="dismiss-reset-link-btn"
                  (click)="dismissResetLink()"
                  aria-label="Fechar aviso de redefinição"
                  class="min-w-11 min-h-11 -mr-2 -my-2 rounded-xl text-gold-900 hover:bg-gold-100 inline-flex items-center justify-center text-lg font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  ×
                </button>
              </div>

              <div class="flex items-center gap-2 w-full">
                <app-festive-icon name="key" svgClass="w-5 h-5 text-gold-600 shrink-0" />
                <h2 class="text-sm font-bold text-gold-950 break-words">
                  Link de Redefinição para &#64;{{ resetInfo.username }}
                </h2>
              </div>
            </div>

            <p class="text-xs text-gold-900 leading-relaxed">
              Envie este link único para o participante criar uma nova senha.
            </p>

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="share-reset-link-btn"
                (click)="shareResetLink(resetInfo)"
                class="flex-1 min-w-[175px] min-h-12 rounded-xl bg-gold-800 hover:bg-gold-900 text-white font-bold text-sm px-4 py-2.5 shadow-sm transition inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <app-festive-icon name="share" svgClass="w-4 h-4" />
                <span>Enviar no WhatsApp</span>
              </button>

              <button
                type="button"
                data-testid="copy-reset-link-btn"
                (click)="copyResetLink(resetInfo)"
                class="flex-1 sm:flex-none min-w-[130px] min-h-12 rounded-xl bg-white hover:bg-gold-100 border border-gold-300 text-gold-950 font-semibold text-sm px-4 py-2.5 transition inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <app-festive-icon [name]="copiedResetLink() ? 'check' : 'copy'" svgClass="w-4 h-4 text-gold-700" />
                <span>{{ copiedResetLink() ? 'Copiado!' : 'Copiar Link' }}</span>
              </button>
            </div>
          </section>
        }

        <section class="space-y-3" data-testid="participants-section">
          <h2 class="font-display text-lg font-bold text-ink-900">
            Participantes Inscritos ({{ g.participants.length }})
          </h2>

          @if (g.participants.length === 0) {
            <p class="text-sm text-ink-600 bg-white border border-festive-border rounded-2xl p-4">
              Nenhum participante inscrito ainda. Compartilhe o link do grupo no WhatsApp da família!
            </p>
          } @else {
            <div class="space-y-3">
              @for (p of g.participants; track p.id) {
                <div
                  data-testid="admin-participant-row"
                  class="bg-festive-card border border-festive-border rounded-2xl p-4 shadow-sm space-y-2.5"
                >
                  <div class="flex items-start gap-3">
                    <div
                      [class]="
                        'w-10 h-10 rounded-xl border font-display font-bold text-xs flex items-center justify-center shrink-0 ' +
                        avatarTone(p.name)
                      "
                    >
                      {{ initials(p.name) }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="font-bold text-ink-900 text-base leading-snug break-words">{{ p.name }}</p>
                      <p class="text-xs text-ink-600 break-all">&#64;{{ p.username }}</p>
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center gap-1.5">
                    <span
                      data-testid="participant-geo-badge"
                      class="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-festive-cream border border-festive-border text-ink-900 font-medium"
                    >
                      <app-festive-icon name="gps" svgClass="w-3 h-3 text-pine-800" />
                      <span>{{ p.hasGeoLocation ? 'GPS 50m' : 'Sem GPS' }}</span>
                    </span>
                    <span
                      data-testid="participant-reveal-badge"
                      [attr.data-reveal-status]="p.revealStatus"
                      [class]="
                        p.revealStatus === 'REVEALED'
                          ? 'text-xs px-2.5 py-0.5 rounded-full bg-pine-100 text-pine-900 font-semibold'
                          : 'text-xs px-2.5 py-0.5 rounded-full bg-gold-50 border border-gold-200 text-gold-900 font-semibold'
                      "
                    >
                      {{ formatRevealStatus(p) }}
                    </span>
                  </div>

                  @if (g.status === 'OPEN' && confirmRemoveParticipantId() === p.id) {
                    <div
                      data-testid="remove-participant-confirm"
                      class="rounded-xl bg-cranberry-50 border border-cranberry-200 p-3 space-y-2.5 animate-fade-slide-up"
                    >
                      <p class="text-xs font-bold text-cranberry-900 break-words">
                        Remover {{ p.name }} do grupo?
                      </p>
                      <div class="flex flex-wrap gap-2">
                        <button
                          type="button"
                          data-testid="confirm-remove-participant-btn"
                          [disabled]="isBusy()"
                          (click)="onConfirmRemoveParticipant(p)"
                          class="flex-1 min-h-11 rounded-xl bg-cranberry-700 hover:bg-cranberry-800 disabled:opacity-60 text-white font-bold text-xs px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                        >
                          Sim, remover
                        </button>
                        <button
                          type="button"
                          data-testid="cancel-remove-participant-btn"
                          [disabled]="isBusy()"
                          (click)="confirmRemoveParticipantId.set(null)"
                          class="min-h-11 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-ink-900 font-semibold text-xs px-3.5 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  } @else {
                    <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-festive-border">
                      <button
                        type="button"
                        data-testid="generate-reset-token-btn"
                        [disabled]="isBusy()"
                        (click)="onGenerateResetToken(p)"
                        class="flex-1 min-h-11 rounded-xl bg-festive-cream hover:bg-stone-200/70 border border-festive-border text-ink-900 font-semibold text-xs px-3 py-2 inline-flex items-center justify-center gap-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                      >
                        <app-festive-icon name="key" svgClass="w-3.5 h-3.5 text-gold-600" />
                        <span>Redefinir Senha</span>
                      </button>

                      @if (g.status === 'OPEN') {
                        <button
                          type="button"
                          data-testid="remove-participant-btn"
                          [disabled]="isBusy()"
                          (click)="requestRemoveParticipant(p)"
                          class="min-h-11 rounded-xl bg-white hover:bg-cranberry-50 border border-cranberry-200 text-cranberry-800 font-semibold text-xs px-3.5 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                        >
                          Remover
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </section>
      }
    </div>
  `
})
export class AdminDashboardPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly apiService = inject(SecretSantaApiService);
  private readonly shareService = inject(ShareLinkService);
  private readonly toastService = inject(ToastService);

  readonly group = signal<AdminGroupView | null>(null);
  readonly isBusy = signal<boolean>(false);
  readonly confirmDrawPending = signal<boolean>(false);
  readonly confirmRotateInvitePending = signal<boolean>(false);
  readonly confirmRemoveParticipantId = signal<string | null>(null);
  readonly copiedInviteLink = signal<boolean>(false);
  readonly copiedResetLink = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly activeResetLink = signal<PasswordResetLinkView | null>(null);

  readonly canExecuteDraw = computed(() => {
    const current = this.group();
    return current !== null && current.status === 'OPEN' && current.participants.length >= 3;
  });

  readonly geoProtectedCount = computed(() => {
    const current = this.group();
    return current ? current.participants.filter((p) => p.hasGeoLocation).length : 0;
  });

  readonly revealedCount = computed(() => {
    const current = this.group();
    return current ? current.participants.filter((p) => p.revealStatus === 'REVEALED').length : 0;
  });

  readonly revealProgressPercent = computed(() => {
    const current = this.group();
    if (!current || current.participants.length === 0) {
      return 0;
    }
    return Math.round((this.revealedCount() / current.participants.length) * 100);
  });

  private groupId = '';
  private copyInviteTimer: ReturnType<typeof setTimeout> | null = null;
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('groupId') ?? '';
    if (this.groupId) {
      this.loadAdminGroup();
    }
  }

  ngOnDestroy(): void {
    if (this.copyInviteTimer !== null) {
      clearTimeout(this.copyInviteTimer);
    }
    if (this.copyResetTimer !== null) {
      clearTimeout(this.copyResetTimer);
    }
  }

  participantCountLabel(count: number): string {
    return formatParticipantCount(count);
  }

  missingParticipantsHint(count: number): string {
    const missing = Math.max(0, 3 - count);
    if (missing === 1) {
      return 'Falta 1 participante para liberar o sorteio.';
    }
    return `Faltam ${missing} participantes para liberar o sorteio.`;
  }

  initials(name: string): string {
    return getInitials(name);
  }

  avatarTone(name: string): string {
    return getAvatarTone(name);
  }

  loadAdminGroup(): void {
    this.errorMessage.set(null);
    this.apiService.getAdminGroup(this.groupId).subscribe({
      next: (adminGroup) => {
        this.group.set(adminGroup);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 401 || err.status === 403) {
          this.errorMessage.set(
            'Acesso restrito: apenas o organizador autenticado deste grupo pode acessar este painel.'
          );
        } else {
          this.errorMessage.set('Não foi possível carregar os dados administrativos do grupo.');
        }
      }
    });
  }

  async shareGroupInviteLink(g: AdminGroupView): Promise<void> {
    const result = await this.shareService.shareLink({
      title: `Amigo Secreto: ${g.eventName}`,
      text: `Participe do grupo de amigo secreto "${g.eventName}" clicando no link abaixo:`,
      pathOrUrl: g.sharePath || `/g/${g.id}`,
      openWhatsAppFallback: true
    });
    this.toastService.success(
      result.method === 'web-share'
        ? 'Link do grupo compartilhado com sucesso!'
        : 'Convite copiado! Envie no WhatsApp da família.'
    );
  }

  async copyGroupPath(g: AdminGroupView): Promise<void> {
    await this.shareService.copyUrl(g.sharePath || `/g/${g.id}`);
    this.copiedInviteLink.set(true);
    if (this.copyInviteTimer !== null) {
      clearTimeout(this.copyInviteTimer);
    }
    this.copyInviteTimer = setTimeout(() => this.copiedInviteLink.set(false), 2000);
    this.toastService.success('Link de convite copiado!');
  }

  onRotateInviteLink(): void {
    if (!this.groupId) {
      return;
    }
    this.errorMessage.set(null);
    this.isBusy.set(true);
    this.apiService.rotateInviteLink(this.groupId).subscribe({
      next: (updatedGroup) => {
        this.isBusy.set(false);
        this.confirmRotateInvitePending.set(false);
        this.group.set(updatedGroup);
        this.toastService.success('Novo link de convite gerado! O link anterior foi invalidado.');
      },
      error: () => {
        this.isBusy.set(false);
        this.confirmRotateInvitePending.set(false);
        this.errorMessage.set('Não foi possível gerar um novo link de convite.');
      }
    });
  }

  requestRemoveParticipant(participant: AdminParticipantView): void {
    this.confirmRemoveParticipantId.set(participant.id);
  }

  onConfirmRemoveParticipant(participant: AdminParticipantView): void {
    if (!this.groupId) {
      return;
    }
    this.errorMessage.set(null);
    this.isBusy.set(true);
    this.apiService.removeParticipant(this.groupId, participant.id).subscribe({
      next: () => {
        this.isBusy.set(false);
        this.confirmDrawPending.set(false);
        this.confirmRemoveParticipantId.set(null);
        this.loadAdminGroup();
        this.toastService.success(`${participant.name} foi removido(a) do grupo.`);
      },
      error: () => {
        this.isBusy.set(false);
        this.confirmRemoveParticipantId.set(null);
        this.errorMessage.set('Não foi possível remover o participante.');
      }
    });
  }

  onExecuteDraw(): void {
    if (!this.groupId) {
      return;
    }
    this.errorMessage.set(null);
    this.isBusy.set(true);
    this.apiService.executeDraw(this.groupId).subscribe({
      next: (updatedGroup) => {
        this.isBusy.set(false);
        this.confirmDrawPending.set(false);
        this.confirmRotateInvitePending.set(false);
        this.confirmRemoveParticipantId.set(null);
        this.group.set(updatedGroup);
        this.toastService.success('Sorteio realizado com sucesso! Os participantes já podem consultar quem tiraram.');
      },
      error: (err: HttpErrorResponse) => {
        this.isBusy.set(false);
        this.confirmDrawPending.set(false);
        if (err.status === 422) {
          this.errorMessage.set('São necessários no mínimo 3 participantes para realizar o sorteio.');
        } else {
          this.errorMessage.set('Não foi possível executar o sorteio.');
        }
      }
    });
  }

  onGenerateResetToken(participant: AdminParticipantView): void {
    if (!this.groupId) {
      return;
    }
    this.errorMessage.set(null);
    this.isBusy.set(true);
    this.apiService.generatePasswordResetToken(this.groupId, participant.id).subscribe({
      next: (resetView) => {
        this.isBusy.set(false);
        this.copiedResetLink.set(false);
        this.activeResetLink.set(resetView);
        void this.shareResetLink(resetView);
      },
      error: () => {
        this.isBusy.set(false);
        this.errorMessage.set('Não foi possível gerar o link de redefinição de senha.');
      }
    });
  }

  dismissResetLink(): void {
    this.activeResetLink.set(null);
    this.copiedResetLink.set(false);
  }

  async shareResetLink(resetInfo: PasswordResetLinkView): Promise<void> {
    const result = await this.shareService.shareLink({
      title: `Redefinição de Senha (@${resetInfo.username})`,
      text: `Use este link de uso único para criar uma nova senha no Amigo Secreto:`,
      pathOrUrl: resetInfo.resetPath
    });
    this.toastService.success(
      result.method === 'web-share'
        ? `Link de redefinição enviado para @${resetInfo.username}!`
        : `Link de redefinição copiado para @${resetInfo.username}!`
    );
  }

  async copyResetLink(resetInfo: PasswordResetLinkView): Promise<void> {
    await this.shareService.copyUrl(resetInfo.resetPath);
    this.copiedResetLink.set(true);
    if (this.copyResetTimer !== null) {
      clearTimeout(this.copyResetTimer);
    }
    this.copyResetTimer = setTimeout(() => this.copiedResetLink.set(false), 2000);
    this.toastService.success(`Link de redefinição copiado para @${resetInfo.username}!`);
  }

  formatRevealStatus(participant: AdminParticipantView): string {
    switch (participant.revealStatus) {
      case 'REVEALED':
        return 'Já descobriu';
      case 'PENDING_REVEAL':
        return 'Ainda não espiou';
      default:
        return 'Aguardando sorteio';
    }
  }
}
