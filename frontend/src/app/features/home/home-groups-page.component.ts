import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';
import { GroupSummaryView } from '../../core/api/secret-santa-api.models';
import { AuthSessionStore } from '../../core/auth/auth-session.store';
import { FestiveIconComponent } from '../../shared/components/festive-icon.component';
import { formatParticipantCount, getAvatarTone, getInitials } from '../../shared/formatters';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-home-groups-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, FestiveIconComponent],
  template: `
    <div class="space-y-6">
      @if (!authStore.isAuthenticated()) {
        <!-- Compact Festive Hero -->
        <section class="bg-gradient-to-br from-pine-900 via-pine-800 to-pine-900 text-white rounded-3xl p-5 shadow-md border border-gold-400/30 space-y-3">
          <div class="flex items-center gap-2 text-amber-200 text-xs font-bold uppercase tracking-wider">
            <app-festive-icon name="pine" svgClass="w-4 h-4" />
            <span>Edição de Natal</span>
          </div>
          <h1 class="font-display text-2xl sm:text-3xl font-bold leading-tight text-white">
            Amigo Secreto
          </h1>
          <p class="text-sm text-emerald-100/95 leading-relaxed">
            Entre para criar seu Amigo Secreto ou participar dos sorteios com a família e amigos!
          </p>
        </section>

        <!-- Direct Login Card -->
        <section class="bg-festive-card border border-festive-border rounded-3xl p-5 shadow-sm space-y-4">
          @if (errorMessage()) {
            <div
              role="alert"
              data-testid="auth-error"
              class="rounded-2xl bg-cranberry-50 border border-cranberry-200 p-3.5 text-sm text-cranberry-800 font-medium break-words"
            >
              {{ errorMessage() }}
            </div>
          }

          <form
            [formGroup]="loginForm"
            (ngSubmit)="submitLogin()"
            data-testid="login-form"
            class="space-y-4"
          >
            <div>
              <label for="login-username" class="block text-sm font-semibold text-ink-900 mb-1.5">
                Seu nome de usuário
              </label>
              <input
                id="login-username"
                type="text"
                formControlName="username"
                placeholder="Ex: maria.silva"
                autocapitalize="none"
                class="w-full min-h-12 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base lowercase text-ink-900 focus:border-pine-800 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
              />
            </div>

            <div>
              <label for="login-password" class="block text-sm font-semibold text-ink-900 mb-1.5">
                Sua senha
              </label>
              <div class="relative flex items-center">
                <input
                  id="login-password"
                  [type]="showLoginPassword() ? 'text' : 'password'"
                  formControlName="password"
                  autocomplete="current-password"
                  placeholder="Digite sua senha"
                  class="w-full min-h-12 rounded-xl border border-stone-300 bg-white pl-3.5 pr-12 py-2.5 text-base text-ink-900 focus:border-pine-800 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                />
                <button
                  type="button"
                  (click)="showLoginPassword.set(!showLoginPassword())"
                  aria-label="Mostrar ou ocultar senha"
                  class="absolute right-1 min-w-11 min-h-11 rounded-lg flex items-center justify-center text-ink-600 hover:text-pine-900 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <app-festive-icon [name]="showLoginPassword() ? 'eye-off' : 'eye'" svgClass="w-5 h-5" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              data-testid="login-submit"
              [disabled]="isSubmitting()"
              class="w-full min-h-12 rounded-xl bg-pine-800 hover:bg-pine-900 disabled:opacity-60 text-white font-bold text-base shadow-sm transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              @if (isSubmitting()) {
                <app-festive-icon name="spinner" svgClass="w-5 h-5" />
                <span>Entrando...</span>
              } @else {
                <span>Entrar</span>
              }
            </button>
          </form>

          <div class="pt-2 border-t border-festive-border text-center">
            <a
              routerLink="/cadastro"
              data-testid="go-to-register-link"
              class="inline-flex items-center justify-center min-h-11 text-sm font-semibold text-pine-800 hover:text-pine-950 underline underline-offset-4"
            >
              Não tem uma conta? Clique aqui
            </a>
          </div>
        </section>
      } @else {
        <!-- Compact Authenticated Identity Bar with discreet switch/logout button -->
        <section class="bg-pine-50 border border-pine-200 rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div
              [class]="
                'w-10 h-10 rounded-xl border font-display font-bold text-sm flex items-center justify-center shrink-0 ' +
                avatarTone(authStore.name() ?? '')
              "
            >
              {{ initials(authStore.name() ?? '') }}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-bold text-ink-900 truncate">
                {{ authStore.name() }}
              </p>
              <p class="text-xs text-ink-600 truncate">&#64;{{ authStore.username() }}</p>
            </div>
          </div>

          <button
            type="button"
            data-testid="switch-family-user-btn"
            (click)="onSwitchFamilyUser()"
            title="Trocar de usuário neste aparelho"
            aria-label="Trocar de perfil ou sair"
            class="min-h-11 px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white border border-pine-200 text-pine-800 hover:text-pine-950 font-semibold text-xs inline-flex items-center gap-1.5 shrink-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <app-festive-icon name="switch-user" svgClass="w-3.5 h-3.5 shrink-0" />
            <span>Trocar / Sair</span>
          </button>
        </section>

        @if (errorMessage() && !isCreateGroupModalOpen()) {
          <div
            role="alert"
            data-testid="group-error"
            class="rounded-2xl bg-cranberry-50 border border-cranberry-200 p-3.5 text-sm text-cranberry-800 font-medium break-words"
          >
            {{ errorMessage() }}
          </div>
        }

        <!-- My Groups Section (Only groups the user participates in or organizes) -->
        <section class="space-y-3" data-testid="my-groups-section">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <app-festive-icon name="gift" svgClass="w-4 h-4 text-cranberry-700 shrink-0" />
              <h2 class="font-display text-lg font-bold text-ink-900 truncate">Meus Grupos</h2>
            </div>

            <button
              type="button"
              data-testid="open-create-group-modal-btn"
              (click)="openCreateGroupModal()"
              class="min-h-11 px-3.5 py-2 rounded-xl bg-pine-800 hover:bg-pine-900 text-white font-bold text-xs shadow-sm inline-flex items-center gap-1.5 shrink-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <span>+ Novo Amigo Secreto</span>
            </button>
          </div>

          @if (myGroups().length === 0) {
            <div class="bg-festive-card border border-festive-border rounded-2xl p-5 text-center space-y-3 shadow-sm">
              <p class="text-sm text-ink-600 leading-relaxed">
                Você ainda não participa nem organiza nenhum grupo. Crie um novo Amigo Secreto ou acesse pelo link de convite recebido no WhatsApp.
              </p>
              <button
                type="button"
                (click)="openCreateGroupModal()"
                class="min-h-11 px-4 py-2 rounded-xl bg-festive-cream hover:bg-gold-50 border border-festive-border text-pine-900 font-bold text-xs inline-flex items-center gap-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <span>+ Novo Amigo Secreto</span>
              </button>
            </div>
          } @else {
            <div class="space-y-3">
              @for (group of myGroups(); track group.id) {
                <div
                  data-testid="my-group-card"
                  [attr.data-group-status]="group.status"
                  class="bg-festive-card border border-festive-border rounded-2xl p-4 shadow-sm space-y-3"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 space-y-1">
                      <h3 class="font-display font-bold text-ink-900 text-base break-words">{{ group.eventName }}</h3>
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-xs text-ink-600 tabular-nums">
                          {{ participantCountLabel(group.participantCount) }}
                        </span>
                        @if (group.status === 'DRAWN') {
                          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cranberry-50 border border-cranberry-200 text-cranberry-800 text-[11px] font-bold">
                            Sorteio realizado!
                          </span>
                        } @else {
                          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gold-50 border border-gold-200 text-gold-900 text-[11px] font-bold">
                            Aberto • Aguardando sorteio
                          </span>
                        }
                      </div>
                    </div>
                    @if (group.organizer) {
                      <span class="px-2.5 py-1 rounded-full bg-gold-100 border border-gold-200 text-gold-900 text-xs font-bold shrink-0">
                        Organizador
                      </span>
                    }
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <a
                      [routerLink]="['/g', group.id]"
                      data-testid="open-group-link"
                      [class]="
                        group.status === 'DRAWN'
                          ? 'flex-1 min-h-12 rounded-xl bg-cranberry-700 hover:bg-cranberry-800 text-white font-bold text-sm flex items-center justify-center gap-2 px-3 shadow-sm transition'
                          : 'flex-1 min-h-12 rounded-xl bg-festive-cream hover:bg-stone-200/70 border border-festive-border text-ink-900 font-semibold text-sm flex items-center justify-center px-3 transition'
                      "
                    >
                      @if (group.status === 'DRAWN') {
                        <app-festive-icon name="gift-open" svgClass="w-4 h-4" />
                        <span>Descobrir Meu Amigo</span>
                      } @else {
                        <span>Ver Grupo</span>
                      }
                    </a>
                    @if (group.organizer) {
                      <a
                        [routerLink]="['/g', group.id, 'admin']"
                        data-testid="open-admin-link"
                        class="flex-1 min-h-12 rounded-xl bg-pine-800 hover:bg-pine-900 text-white font-semibold text-sm flex items-center justify-center px-3 shadow-sm transition"
                      >
                        Painel Admin
                      </a>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <!-- Create New Group Modal -->
        @if (isCreateGroupModalOpen()) {
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-group-modal-title"
            data-testid="create-group-modal"
            class="fixed inset-0 z-50 bg-pine-950/85 backdrop-blur-sm flex p-4 overflow-y-auto"
          >
            <div class="m-auto w-full max-w-md bg-festive-card border border-festive-border rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-fade-slide-up">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <h2 id="create-group-modal-title" class="font-display text-xl font-bold text-ink-900">
                    Novo Amigo Secreto
                  </h2>
                  <p class="text-xs text-ink-600 mt-0.5">
                    Você será o organizador e poderá convidar os participantes pelo link exclusivo.
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="close-create-group-modal-btn"
                  (click)="closeCreateGroupModal()"
                  aria-label="Fechar modal"
                  class="min-w-11 min-h-11 rounded-xl bg-festive-cream hover:bg-stone-200/70 text-ink-900 font-bold text-lg flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  ×
                </button>
              </div>

              @if (errorMessage()) {
                <div
                  role="alert"
                  data-testid="group-error"
                  class="rounded-2xl bg-cranberry-50 border border-cranberry-200 p-3 text-sm text-cranberry-800 font-medium break-words"
                >
                  {{ errorMessage() }}
                </div>
              }

              <form
                [formGroup]="createGroupForm"
                (ngSubmit)="submitCreateGroup()"
                data-testid="create-group-form"
                class="space-y-4"
              >
                <div>
                  <label for="event-name" class="block text-sm font-semibold text-ink-900 mb-1.5">
                    Nome do Evento (3 a 100 caracteres)
                  </label>
                  <input
                    id="event-name"
                    type="text"
                    formControlName="eventName"
                    placeholder="Ex: Natal da Família Silva"
                    class="w-full min-h-12 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base text-ink-900 focus:border-pine-800 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                  />
                </div>

                <div class="flex flex-col sm:flex-row gap-2">
                  <button
                    type="submit"
                    data-testid="create-group-submit"
                    [disabled]="isSubmitting()"
                    class="flex-1 min-h-12 rounded-xl bg-pine-800 hover:bg-pine-900 disabled:opacity-60 text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    @if (creatingGroup()) {
                      <app-festive-icon name="spinner" svgClass="w-4 h-4" />
                      <span>Criando...</span>
                    } @else {
                      <span>Criar Amigo Secreto</span>
                    }
                  </button>
                  <button
                    type="button"
                    (click)="closeCreateGroupModal()"
                    class="min-h-12 px-4 rounded-xl bg-festive-cream hover:bg-stone-200/70 border border-festive-border text-ink-900 font-semibold text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        }
      }
    </div>
  `
})
export class HomeGroupsPageComponent implements OnInit {
  readonly authStore = inject(AuthSessionStore);
  private readonly apiService = inject(SecretSantaApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toastService = inject(ToastService);

  readonly showLoginPassword = signal<boolean>(false);
  readonly myGroups = signal<GroupSummaryView[]>([]);
  readonly isSubmitting = signal<boolean>(false);
  readonly creatingGroup = signal<boolean>(false);
  readonly isCreateGroupModalOpen = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly loginForm = this.fb.group({
    username: ['', [Validators.required, Validators.pattern(/^[a-z0-9._-]{3,30}$/)]],
    password: ['', [Validators.required]]
  });

  readonly createGroupForm = this.fb.group({
    eventName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]]
  });

  constructor() {
    effect(() => {
      if (this.authStore.isAuthenticated()) {
        this.loadGroups();
      }
    });
  }

  ngOnInit(): void {
    if (this.authStore.isAuthenticated()) {
      this.loadGroups();
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

  openCreateGroupModal(): void {
    this.errorMessage.set(null);
    this.isCreateGroupModalOpen.set(true);
  }

  closeCreateGroupModal(): void {
    this.isCreateGroupModalOpen.set(false);
    this.errorMessage.set(null);
    this.createGroupForm.reset();
  }

  submitLogin(): void {
    this.errorMessage.set(null);
    const { username, password } = this.loginForm.getRawValue();
    const normalizedUsername = username.trim().toLowerCase();

    if (!/^[a-z0-9._-]{3,30}$/.test(normalizedUsername) || !password) {
      this.errorMessage.set('Informe seu nome de usuário e sua senha.');
      return;
    }

    this.isSubmitting.set(true);
    this.apiService
      .login({
        username: normalizedUsername,
        password
      })
      .subscribe({
        next: (session) => {
          this.isSubmitting.set(false);
          this.showLoginPassword.set(false);
          this.loginForm.reset();
          this.authStore.setSession(session);
        },
        error: () => {
          this.isSubmitting.set(false);
          this.errorMessage.set('Nome de usuário ou senha incorretos.');
        }
      });
  }

  loadGroups(): void {
    if (!this.authStore.isAuthenticated()) {
      return;
    }
    this.apiService.listGroups().subscribe({
      next: (discovery) => {
        this.myGroups.set(discovery.myGroups);
      },
      error: () => {
        this.errorMessage.set('Erro ao carregar a lista de grupos.');
      }
    });
  }

  submitCreateGroup(): void {
    this.errorMessage.set(null);
    const eventName = this.createGroupForm.controls.eventName.value.trim();

    if (eventName.length < 3 || eventName.length > 100) {
      this.errorMessage.set('O nome do evento deve ter entre 3 e 100 caracteres.');
      return;
    }

    this.isSubmitting.set(true);
    this.creatingGroup.set(true);
    this.apiService.createGroup({ eventName }).subscribe({
      next: (created) => {
        this.isSubmitting.set(false);
        this.creatingGroup.set(false);
        this.createGroupForm.reset();
        this.isCreateGroupModalOpen.set(false);
        this.toastService.success(`Grupo "${created.eventName}" criado com sucesso!`);
        this.loadGroups();
      },
      error: () => {
        this.isSubmitting.set(false);
        this.creatingGroup.set(false);
        this.errorMessage.set('Não foi possível criar o grupo.');
      }
    });
  }

  onSwitchFamilyUser(): void {
    this.apiService
      .logout()
      .pipe(
        finalize(() => {
          this.authStore.switchFamilyUser();
          this.myGroups.set([]);
          this.isCreateGroupModalOpen.set(false);
          this.errorMessage.set(null);
          this.showLoginPassword.set(false);
          this.loginForm.reset();
        })
      )
      .subscribe({
        error: () => {
          // Session cleared in finalize even if logout request fails
        }
      });
  }
}
