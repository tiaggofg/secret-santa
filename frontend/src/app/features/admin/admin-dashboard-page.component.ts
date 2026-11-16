import { Component, computed, inject, OnInit, signal } from '@angular/core';
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

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [RouterLink, FestiveIconComponent],
  template: `
    <div class="space-y-6">
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

      @if (shareFeedback()) {
        <div
          role="status"
          data-testid="share-feedback"
          class="rounded-2xl bg-pine-50 border border-pine-200 p-3.5 text-sm text-pine-900 font-medium break-all"
        >
          {{ shareFeedback() }}
        </div>
      }

      @if (group(); as g) {
        <section class="bg-festive-card border border-festive-border rounded-3xl p-5 shadow-sm space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <span class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-600">
                <app-festive-icon name="star" svgClass="w-3.5 h-3.5" />
                Painel do Organizador
              </span>
              <h1 class="font-display text-2xl font-bold text-ink-900 mt-0.5 break-words leading-tight">
                {{ g.eventName }}
              </h1>
            </div>
            <span
              data-testid="group-status-badge"
              [attr.data-group-status]="g.status"
              [class]="
                g.status === 'DRAWN'
                  ? 'px-3 py-1 rounded-full bg-cranberry-50 border border-cranberry-200 text-cranberry-800 text-xs font-bold shrink-0'
                  : 'px-3 py-1 rounded-full bg-gold-100 border border-gold-200 text-gold-900 text-xs font-bold shrink-0'
              "
            >
              {{ g.status === 'DRAWN' ? 'Sorteio Realizado' : 'Inscrições Abertas' }}
            </span>
          </div>

          <!-- Summary Metric Pills -->
          <div class="flex flex-wrap gap-2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-festive-cream border border-festive-border text-xs font-semibold text-ink-900 tabular-nums">
              {{ participantCountLabel(g.participants.length) }}
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pine-50 border border-pine-200 text-xs font-semibold text-pine-900 tabular-nums">
              <app-festive-icon name="gps" svgClass="w-3.5 h-3.5 text-pine-800" />
              {{ geoProtectedCount() }} com proteção GPS 50m
            </span>
            @if (g.status === 'DRAWN') {
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cranberry-50 border border-cranberry-200 text-xs font-semibold text-cranberry-800 tabular-nums">
                <app-festive-icon name="gift-open" svgClass="w-3.5 h-3.5" />
                {{ revealedCount() }} de {{ g.participants.length }} já descobriram
              </span>
            }
          </div>

          @if (g.status === 'DRAWN' && g.geographicRestrictionRelaxed) {
            <div
              data-testid="geo-relaxed-badge"
              class="rounded-2xl bg-gold-50 border border-gold-200 p-3 text-xs text-gold-950 break-words"
            >
              Nota do sorteio: mais de 50% dos inscritos estavam na mesma residência, portanto o relaxamento geográfico automático foi acionado para garantir que todos participassem.
            </div>
          }

          <!-- Share Group Invite -->
          <div class="space-y-2">
            <button
              type="button"
              data-testid="share-group-link-btn"
              (click)="shareGroupInviteLink(g)"
              class="w-full min-h-12 rounded-xl bg-pine-800 hover:bg-pine-900 text-white font-bold text-sm px-4 py-3 shadow-sm transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <app-festive-icon name="share" svgClass="w-4 h-4" />
              <span>Convidar pelo WhatsApp</span>
            </button>

            <div class="flex items-center justify-between gap-2 rounded-xl bg-festive-cream border border-festive-border px-3 py-2">
              <span data-testid="signed-share-path" class="text-xs font-mono text-ink-600 break-all">
                {{ g.sharePath || '/g/' + g.id }}
              </span>
              <button
                type="button"
                data-testid="copy-group-link-btn"
                (click)="copyGroupPath(g)"
                class="min-h-9 px-2.5 rounded-lg bg-white border border-festive-border hover:bg-stone-100 text-ink-900 text-xs font-semibold inline-flex items-center gap-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <app-festive-icon name="copy" svgClass="w-3.5 h-3.5" />
                <span>Copiar</span>
              </button>
            </div>

            <div class="flex justify-end">
              <button
                type="button"
                data-testid="rotate-invite-link-btn"
                [disabled]="isBusy()"
                (click)="onRotateInviteLink()"
                class="min-h-9 px-3 rounded-lg text-xs font-semibold text-ink-600 hover:text-pine-900 hover:bg-festive-cream border border-transparent hover:border-festive-border inline-flex items-center gap-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <app-festive-icon name="key" svgClass="w-3.5 h-3.5 text-gold-600" />
                <span>Gerar Novo Link de Convite</span>
              </button>
            </div>
          </div>

          @if (g.status === 'OPEN') {
            <div class="pt-3 border-t border-festive-border space-y-3">
              @if (!canExecuteDraw()) {
                <p data-testid="min-participants-hint" class="text-xs text-ink-600">
                  São necessários pelo menos 3 participantes inscritos para realizar o sorteio (atual: {{ g.participants.length }}).
                </p>
              }

              @if (!confirmDrawPending()) {
                <button
                  type="button"
                  data-testid="execute-draw-btn"
                  [disabled]="!canExecuteDraw() || isBusy()"
                  (click)="confirmDrawPending.set(true)"
                  class="w-full min-h-12 rounded-xl bg-cranberry-700 hover:bg-cranberry-800 disabled:opacity-40 text-white font-bold text-base shadow-sm transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <app-festive-icon name="gift" svgClass="w-5 h-5" />
                  <span>Realizar Sorteio Agora ({{ g.participants.length }} inscritos)</span>
                </button>
              } @else {
                <!-- Inline Expandable Confirmation -->
                <div class="rounded-2xl bg-cranberry-50 border-2 border-cranberry-200 p-4 space-y-3 animate-fade-slide-up">
                  <p class="text-sm font-bold text-cranberry-800">
                    Confirmar realização do sorteio?
                  </p>
                  <p class="text-xs text-ink-900 leading-relaxed">
                    Esta ação é definitiva: após o sorteio, não será mais possível remover participantes deste grupo.
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
          }
        </section>

        @if (activeResetLink(); as resetInfo) {
          <section
            data-testid="generated-reset-link-card"
            class="bg-gold-50 border border-gold-300 rounded-3xl p-4 sm:p-5 space-y-3 shadow-sm animate-fade-slide-up"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <app-festive-icon name="key" svgClass="w-5 h-5 text-gold-600 shrink-0" />
                <h2 class="text-sm font-bold text-gold-950 break-words">
                  Link de Redefinição para &#64;{{ resetInfo.username }}
                </h2>
              </div>
              <span class="px-2.5 py-0.5 rounded-full bg-gold-100 border border-gold-200 text-gold-900 text-[11px] font-bold shrink-0">
                Uso único • Válido por 24h
              </span>
            </div>

            <p class="text-xs text-gold-900 break-all font-mono bg-white p-3 rounded-xl border border-gold-200">
              {{ resetInfo.resetPath }}
            </p>

            <button
              type="button"
              data-testid="share-reset-link-btn"
              (click)="shareResetLink(resetInfo)"
              class="w-full min-h-12 rounded-xl bg-gold-800 hover:bg-gold-900 text-white font-bold text-sm px-4 py-2.5 shadow-sm transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <app-festive-icon name="share" svgClass="w-4 h-4" />
              <span>Enviar no WhatsApp</span>
            </button>
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
                  class="bg-festive-card border border-festive-border rounded-2xl p-4 shadow-sm space-y-3"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-3 min-w-0">
                      <div
                        [class]="
                          'w-10 h-10 rounded-xl border font-display font-bold text-xs flex items-center justify-center shrink-0 ' +
                          avatarTone(p.name)
                        "
                      >
                        {{ initials(p.name) }}
                      </div>
                      <div class="min-w-0">
                        <p class="font-bold text-ink-900 text-base truncate">{{ p.name }}</p>
                        <p class="text-xs text-ink-600 truncate">&#64;{{ p.username }}</p>
                      </div>
                    </div>
                    <div class="flex flex-col items-end gap-1 shrink-0">
                      <span
                        data-testid="participant-geo-badge"
                        class="text-xs px-2.5 py-0.5 rounded-full bg-festive-cream border border-festive-border text-ink-900 font-medium"
                      >
                        {{ p.hasGeoLocation ? 'GPS Ativo (50m)' : 'Sem GPS' }}
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
                  </div>

                  <div class="flex flex-wrap gap-2 pt-2 border-t border-festive-border">
                    <button
                      type="button"
                      data-testid="generate-reset-token-btn"
                      [disabled]="isBusy()"
                      (click)="onGenerateResetToken(p)"
                      class="flex-1 min-h-12 rounded-xl bg-festive-cream hover:bg-stone-200/70 border border-festive-border text-ink-900 font-semibold text-xs px-3 py-2 inline-flex items-center justify-center gap-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    >
                      <app-festive-icon name="key" svgClass="w-3.5 h-3.5 text-gold-600" />
                      <span>Gerar Link de Reset de PIN</span>
                    </button>

                    @if (g.status === 'OPEN') {
                      <button
                        type="button"
                        data-testid="remove-participant-btn"
                        [disabled]="isBusy()"
                        (click)="onRemoveParticipant(p)"
                        class="min-h-12 rounded-xl bg-cranberry-50 hover:bg-cranberry-100 border border-cranberry-200 text-cranberry-800 font-semibold text-xs px-3.5 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                      >
                        Remover
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </section>
      }
    </div>
  `
})
export class AdminDashboardPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly apiService = inject(SecretSantaApiService);
  private readonly shareService = inject(ShareLinkService);

  readonly group = signal<AdminGroupView | null>(null);
  readonly isBusy = signal<boolean>(false);
  readonly confirmDrawPending = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly shareFeedback = signal<string | null>(null);
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

  private groupId = '';

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('groupId') ?? '';
    if (this.groupId) {
      this.loadAdminGroup();
    }
  }

  participantCountLabel(count: number): string {
    return formatParticipantCount(count);
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
    this.shareFeedback.set(null);
    const result = await this.shareService.shareLink({
      title: `Amigo Secreto: ${g.eventName}`,
      text: `Participe do grupo de amigo secreto "${g.eventName}" clicando no link abaixo:`,
      pathOrUrl: g.sharePath || `/g/${g.id}`,
      openWhatsAppFallback: true
    });
    this.shareFeedback.set(
      result.method === 'web-share'
        ? 'Link do grupo compartilhado com sucesso!'
        : `Mensagem e link copiados para a área de transferência: ${result.url}`
    );
  }

  async copyGroupPath(g: AdminGroupView): Promise<void> {
    this.shareFeedback.set(null);
    const result = await this.shareService.copyUrl(g.sharePath || `/g/${g.id}`);
    this.shareFeedback.set(`Link copiado para a área de transferência: ${result.url}`);
  }

  onRotateInviteLink(): void {
    if (!this.groupId) {
      return;
    }
    this.errorMessage.set(null);
    this.shareFeedback.set(null);
    this.isBusy.set(true);
    this.apiService.rotateInviteLink(this.groupId).subscribe({
      next: (updatedGroup) => {
        this.isBusy.set(false);
        this.group.set(updatedGroup);
        this.shareFeedback.set('Novo link de convite gerado! O link anterior foi invalidado.');
      },
      error: () => {
        this.isBusy.set(false);
        this.errorMessage.set('Não foi possível gerar um novo link de convite.');
      }
    });
  }

  onRemoveParticipant(participant: AdminParticipantView): void {
    if (!this.groupId) {
      return;
    }
    this.errorMessage.set(null);
    this.isBusy.set(true);
    this.apiService.removeParticipant(this.groupId, participant.id).subscribe({
      next: () => {
        this.isBusy.set(false);
        this.confirmDrawPending.set(false);
        this.loadAdminGroup();
      },
      error: () => {
        this.isBusy.set(false);
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
        this.group.set(updatedGroup);
        this.shareFeedback.set('Sorteio realizado com sucesso! Os participantes já podem consultar quem tiraram.');
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
        this.activeResetLink.set(resetView);
        void this.shareResetLink(resetView);
      },
      error: () => {
        this.isBusy.set(false);
        this.errorMessage.set('Não foi possível gerar o link de redefinição de PIN.');
      }
    });
  }

  async shareResetLink(resetInfo: PasswordResetLinkView): Promise<void> {
    const result = await this.shareService.shareLink({
      title: `Redefinição de PIN (@${resetInfo.username})`,
      text: `Use este link de uso único para criar um novo PIN no Amigo Secreto:`,
      pathOrUrl: resetInfo.resetPath
    });
    this.shareFeedback.set(
      result.method === 'web-share'
        ? `Link de redefinição enviado para @${resetInfo.username}!`
        : `Link de redefinição copiado: ${result.url}`
    );
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
