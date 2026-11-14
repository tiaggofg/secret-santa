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

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <a
          routerLink="/"
          class="text-sm font-semibold text-emerald-800 hover:underline inline-flex items-center gap-1"
        >
          ← Voltar para Meus Grupos
        </a>
        @if (group(); as g) {
          <a
            [routerLink]="['/g', g.slug]"
            data-testid="view-public-group-link"
            class="text-sm font-semibold text-slate-700 hover:underline"
          >
            Página Pública
          </a>
        }
      </div>

      @if (errorMessage()) {
        <div
          role="alert"
          data-testid="admin-error"
          class="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800 font-medium"
        >
          {{ errorMessage() }}
        </div>
      }

      @if (shareFeedback()) {
        <div
          role="status"
          data-testid="share-feedback"
          class="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 font-medium"
        >
          {{ shareFeedback() }}
        </div>
      }

      @if (group(); as g) {
        <section class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Painel do Organizador
              </span>
              <h1 class="text-xl font-bold text-slate-900 mt-0.5">{{ g.eventName }}</h1>
            </div>
            <span
              data-testid="group-status-badge"
              [class]="
                g.status === 'DRAWN'
                  ? 'px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold'
                  : 'px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold'
              "
            >
              {{ g.status === 'DRAWN' ? 'DRAWN (Sorteado)' : 'OPEN (Inscrições Abertas)' }}
            </span>
          </div>

          @if (g.status === 'DRAWN' && g.geographicRestrictionRelaxed) {
            <div
              data-testid="geo-relaxed-badge"
              class="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900"
            >
              Nota técnica: mais de 50% dos inscritos estavam na mesma residência, portanto o relaxamento geográfico automático foi acionado para garantir o sorteio.
            </div>
          }

          <button
            type="button"
            data-testid="share-group-link-btn"
            (click)="shareGroupInviteLink(g)"
            class="w-full min-h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm px-4 py-3 shadow-sm transition flex items-center justify-center gap-2"
          >
            <span>Compartilhar Link do Grupo no WhatsApp ({{ g.sharePath }})</span>
          </button>

          @if (g.status === 'OPEN') {
            <div class="pt-2 border-t border-slate-100 space-y-2">
              @if (!canExecuteDraw()) {
                <p data-testid="min-participants-hint" class="text-xs text-slate-600">
                  São necessários pelo menos 3 participantes inscritos para realizar o sorteio (atual: {{ g.participants.length }}).
                </p>
              }
              <button
                type="button"
                data-testid="execute-draw-btn"
                [disabled]="!canExecuteDraw() || isBusy()"
                (click)="onExecuteDraw()"
                class="w-full min-h-12 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-base shadow-sm transition"
              >
                Realizar Sorteio Agora ({{ g.participants.length }} inscritos)
              </button>
            </div>
          }
        </section>

        @if (activeResetLink(); as resetInfo) {
          <section
            data-testid="generated-reset-link-card"
            class="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-3"
          >
            <h2 class="text-sm font-bold text-amber-950">
              Link Único de Redefinição de PIN para &#64;{{ resetInfo.username }}
            </h2>
            <p class="text-xs text-amber-900 break-all font-mono bg-white p-2.5 rounded-lg border border-amber-200">
              {{ resetInfo.resetPath }}
            </p>
            <button
              type="button"
              data-testid="share-reset-link-btn"
              (click)="shareResetLink(resetInfo)"
              class="w-full min-h-12 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs px-3 py-2"
            >
              Compartilhar Link de Redefinição no WhatsApp
            </button>
          </section>
        }

        <section class="space-y-3" data-testid="participants-section">
          <h2 class="text-lg font-bold text-slate-900">
            Participantes Inscritos ({{ g.participants.length }})
          </h2>

          @if (g.participants.length === 0) {
            <p class="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
              Nenhum participante inscrito ainda. Compartilhe o link do grupo no WhatsApp da família!
            </p>
          } @else {
            <div class="space-y-3">
              @for (p of g.participants; track p.id) {
                <div
                  data-testid="admin-participant-row"
                  class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <p class="font-bold text-slate-900 text-base">{{ p.name }}</p>
                      <p class="text-xs text-slate-600">&#64;{{ p.username }}</p>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                      <span
                        data-testid="participant-geo-badge"
                        class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium"
                      >
                        {{ p.hasGeoLocation ? 'GPS Ativo (50m)' : 'Sem GPS' }}
                      </span>
                      <span
                        data-testid="participant-reveal-badge"
                        class="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold"
                      >
                        {{ formatRevealStatus(p) }}
                      </span>
                    </div>
                  </div>

                  <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      data-testid="generate-reset-token-btn"
                      [disabled]="isBusy()"
                      (click)="onGenerateResetToken(p)"
                      class="flex-1 min-h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs px-3 py-2"
                    >
                      Gerar Link de Reset de PIN
                    </button>

                    @if (g.status === 'OPEN') {
                      <button
                        type="button"
                        data-testid="remove-participant-btn"
                        [disabled]="isBusy()"
                        (click)="onRemoveParticipant(p)"
                        class="min-h-12 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs px-3 py-2"
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
  readonly errorMessage = signal<string | null>(null);
  readonly shareFeedback = signal<string | null>(null);
  readonly activeResetLink = signal<PasswordResetLinkView | null>(null);

  readonly canExecuteDraw = computed(() => {
    const current = this.group();
    return current !== null && current.status === 'OPEN' && current.participants.length >= 3;
  });

  private slug = '';

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
    if (this.slug) {
      this.loadAdminGroup();
    }
  }

  loadAdminGroup(): void {
    this.errorMessage.set(null);
    this.apiService.getAdminGroup(this.slug).subscribe({
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
      text: `Participe do grupo "${g.eventName}" no Amigo Secreto Familiar!`,
      pathOrUrl: g.sharePath || `/g/${g.slug}`
    });
    this.shareFeedback.set(
      result.method === 'web-share'
        ? 'Link do grupo compartilhado com sucesso!'
        : `Link copiado para a área de transferência: ${result.url}`
    );
  }

  onRemoveParticipant(participant: AdminParticipantView): void {
    if (!this.slug) {
      return;
    }
    this.errorMessage.set(null);
    this.isBusy.set(true);
    this.apiService.removeParticipant(this.slug, participant.id).subscribe({
      next: () => {
        this.isBusy.set(false);
        this.loadAdminGroup();
      },
      error: () => {
        this.isBusy.set(false);
        this.errorMessage.set('Não foi possível remover o participante.');
      }
    });
  }

  onExecuteDraw(): void {
    if (!this.slug) {
      return;
    }
    this.errorMessage.set(null);
    this.isBusy.set(true);
    this.apiService.executeDraw(this.slug).subscribe({
      next: (updatedGroup) => {
        this.isBusy.set(false);
        this.group.set(updatedGroup);
        this.shareFeedback.set('Sorteio realizado com sucesso! Os participantes já podem consultar quem tiraram.');
      },
      error: (err: HttpErrorResponse) => {
        this.isBusy.set(false);
        if (err.status === 422) {
          this.errorMessage.set('São necessários no mínimo 3 participantes para realizar o sorteio.');
        } else {
          this.errorMessage.set('Não foi possível executar o sorteio.');
        }
      }
    });
  }

  onGenerateResetToken(participant: AdminParticipantView): void {
    if (!this.slug) {
      return;
    }
    this.errorMessage.set(null);
    this.isBusy.set(true);
    this.apiService.generatePasswordResetToken(this.slug, participant.id).subscribe({
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
        return 'Já consultou (REVEALED)';
      case 'PENDING_REVEAL':
        return 'Pendente (PENDING_REVEAL)';
      default:
        return 'Aguardando sorteio (WAITING_DRAW)';
    }
  }
}
