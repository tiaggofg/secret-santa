import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';
import { GroupSummaryView } from '../../core/api/secret-santa-api.models';
import { AuthSessionStore } from '../../core/auth/auth-session.store';
import { FestiveIconComponent } from '../../shared/components/festive-icon.component';
import { formatParticipantCount, getAvatarTone, getInitials } from '../../shared/formatters';

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
            Organize o sorteio pelo WhatsApp em segundos, com proteção automática para não tirar quem mora na mesma casa.
          </p>
          <div class="flex flex-wrap gap-2 pt-1">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-semibold text-white">
              <app-festive-icon name="check" svgClass="w-3.5 h-3.5 text-amber-300" />
              Sem e-mail
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-semibold text-white">
              <app-festive-icon name="key" svgClass="w-3.5 h-3.5 text-amber-300" />
              PIN de 4-6 dígitos
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-semibold text-white">
              <app-festive-icon name="gps" svgClass="w-3.5 h-3.5 text-amber-300" />
              Evita mesma casa
            </span>
          </div>
        </section>

        <!-- Auth Card -->
        <section class="bg-festive-card border border-festive-border rounded-3xl p-5 shadow-sm space-y-4">
          <div class="grid grid-cols-2 gap-2 bg-festive-cream border border-festive-border p-1.5 rounded-2xl" role="tablist">
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="authMode() === 'register'"
              data-testid="tab-register"
              (click)="setAuthMode('register')"
              [class]="
                authMode() === 'register'
                  ? 'min-h-12 rounded-xl bg-white text-pine-900 font-bold shadow-sm text-sm border border-festive-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500'
                  : 'min-h-12 rounded-xl text-ink-600 font-semibold text-sm hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500'
              "
            >
              Criar Cadastro
            </button>
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="authMode() === 'login'"
              data-testid="tab-login"
              (click)="setAuthMode('login')"
              [class]="
                authMode() === 'login'
                  ? 'min-h-12 rounded-xl bg-white text-pine-900 font-bold shadow-sm text-sm border border-festive-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500'
                  : 'min-h-12 rounded-xl text-ink-600 font-semibold text-sm hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500'
              "
            >
              Já tenho conta
            </button>
          </div>

          @if (errorMessage()) {
            <div
              role="alert"
              data-testid="auth-error"
              class="rounded-2xl bg-cranberry-50 border border-cranberry-200 p-3.5 text-sm text-cranberry-800 font-medium break-words"
            >
              {{ errorMessage() }}
            </div>
          }

          @if (authMode() === 'register') {
            <form
              [formGroup]="registerForm"
              (ngSubmit)="submitRegister()"
              data-testid="register-form"
              class="space-y-4"
            >
              <div>
                <label for="reg-name" class="block text-sm font-semibold text-ink-900 mb-1.5">
                  Seu Nome
                </label>
                <input
                  id="reg-name"
                  type="text"
                  formControlName="name"
                  (input)="onNameInput()"
                  placeholder="Ex: Maria Silva"
                  class="w-full min-h-12 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base text-ink-900 focus:border-pine-800 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                />
                @if (
                  (registerForm.controls.name.touched || registerForm.controls.name.dirty) &&
                  registerForm.controls.name.invalid
                ) {
                  <p class="text-xs text-cranberry-700 font-medium mt-1">
                    Informe seu nome completo ou apelido (2 a 60 caracteres).
                  </p>
                }
              </div>

              <div>
                <label for="reg-username" class="block text-sm font-semibold text-ink-900 mb-1.5">
                  Nome de Usuário (username)
                </label>
                <input
                  id="reg-username"
                  type="text"
                  formControlName="username"
                  (input)="onUsernameManualEdit()"
                  placeholder="Ex: maria.silva"
                  autocapitalize="none"
                  class="w-full min-h-12 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base lowercase text-ink-900 focus:border-pine-800 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                />
                <p class="text-xs text-ink-600 mt-1">
                  3 a 30 caracteres (letras minúsculas, números, ponto, hífen ou underline).
                </p>
                @if (
                  (registerForm.controls.username.touched || registerForm.controls.username.dirty) &&
                  registerForm.controls.username.invalid
                ) {
                  <p class="text-xs text-cranberry-700 font-medium mt-1">
                    Use apenas letras minúsculas, números, ponto, hífen ou underline (3 a 30 caracteres).
                  </p>
                }
              </div>

              <div>
                <label for="reg-pin" class="block text-sm font-semibold text-ink-900 mb-1.5">
                  PIN Numérico (4 a 6 dígitos)
                </label>
                <div class="relative flex items-center">
                  <input
                    id="reg-pin"
                    [type]="showRegPin() ? 'text' : 'password'"
                    inputmode="numeric"
                    maxlength="6"
                    formControlName="pin"
                    placeholder="Ex: 1234"
                    class="w-full min-h-12 rounded-xl border border-stone-300 bg-white pl-3.5 pr-12 py-2.5 text-lg tracking-widest tabular-nums text-ink-900 focus:border-pine-800 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    (click)="showRegPin.set(!showRegPin())"
                    aria-label="Mostrar ou ocultar PIN"
                    class="absolute right-1 min-w-11 min-h-11 rounded-lg flex items-center justify-center text-ink-600 hover:text-pine-900 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    <app-festive-icon [name]="showRegPin() ? 'eye-off' : 'eye'" svgClass="w-5 h-5" />
                  </button>
                </div>
                @if (
                  (registerForm.controls.pin.touched || registerForm.controls.pin.dirty) &&
                  registerForm.controls.pin.invalid
                ) {
                  <p class="text-xs text-cranberry-700 font-medium mt-1">
                    Digite apenas números de 4 a 6 dígitos (ex: 1234).
                  </p>
                }
              </div>

              <button
                type="submit"
                data-testid="register-submit"
                [disabled]="isSubmitting()"
                class="w-full min-h-12 rounded-xl bg-pine-800 hover:bg-pine-900 disabled:opacity-60 text-white font-bold text-base shadow-sm transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                @if (isSubmitting()) {
                  <app-festive-icon name="spinner" svgClass="w-5 h-5" />
                  <span>Cadastrando...</span>
                } @else {
                  <span>Cadastrar e Ver Grupos</span>
                }
              </button>
            </form>
          } @else {
            <form
              [formGroup]="loginForm"
              (ngSubmit)="submitLogin()"
              data-testid="login-form"
              class="space-y-4"
            >
              <div>
                <label for="login-username" class="block text-sm font-semibold text-ink-900 mb-1.5">
                  Seu Username
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
                <label for="login-pin" class="block text-sm font-semibold text-ink-900 mb-1.5">
                  Seu PIN (4 a 6 dígitos)
                </label>
                <div class="relative flex items-center">
                  <input
                    id="login-pin"
                    [type]="showLoginPin() ? 'text' : 'password'"
                    inputmode="numeric"
                    maxlength="6"
                    formControlName="pin"
                    placeholder="••••"
                    class="w-full min-h-12 rounded-xl border border-stone-300 bg-white pl-3.5 pr-12 py-2.5 text-lg tracking-widest tabular-nums text-ink-900 focus:border-pine-800 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    (click)="showLoginPin.set(!showLoginPin())"
                    aria-label="Mostrar ou ocultar PIN"
                    class="absolute right-1 min-w-11 min-h-11 rounded-lg flex items-center justify-center text-ink-600 hover:text-pine-900 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    <app-festive-icon [name]="showLoginPin() ? 'eye-off' : 'eye'" svgClass="w-5 h-5" />
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
          }
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
            title="Cadastrar outro familiar ou trocar de usuário neste aparelho"
            aria-label="Trocar de perfil ou sair"
            class="min-h-11 px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white border border-pine-200 text-pine-800 hover:text-pine-950 font-semibold text-xs inline-flex items-center gap-1.5 shrink-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <app-festive-icon name="switch-user" svgClass="w-3.5 h-3.5 shrink-0" />
            <span>Trocar / Sair</span>
          </button>
        </section>

        @if (statusMessage()) {
          <div
            role="status"
            data-testid="status-message"
            class="rounded-2xl bg-pine-50 border border-pine-200 p-3.5 text-sm text-pine-900 font-medium break-words"
          >
            {{ statusMessage() }}
          </div>
        }

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
              <span>+ Criar Grupo</span>
            </button>
          </div>

          @if (myGroups().length === 0) {
            <div class="bg-festive-card border border-festive-border rounded-2xl p-5 text-center space-y-3 shadow-sm">
              <p class="text-sm text-ink-600 leading-relaxed">
                Você ainda não participa nem organiza nenhum grupo. Crie um novo grupo ou acesse pelo link de convite recebido no WhatsApp.
              </p>
              <button
                type="button"
                (click)="openCreateGroupModal()"
                class="min-h-11 px-4 py-2 rounded-xl bg-festive-cream hover:bg-gold-50 border border-festive-border text-pine-900 font-bold text-xs inline-flex items-center gap-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <span>+ Criar Primeiro Grupo</span>
              </button>
            </div>
          } @else {
            <div class="space-y-3">
              @for (group of myGroups(); track group.slug) {
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
                      [routerLink]="['/g', group.slug]"
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
                        [routerLink]="['/g', group.slug, 'admin']"
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
            class="fixed inset-0 z-50 bg-pine-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          >
            <div class="w-full max-w-md bg-festive-card border border-festive-border rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-fade-slide-up">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <h2 id="create-group-modal-title" class="font-display text-xl font-bold text-ink-900">
                    Criar Novo Grupo
                  </h2>
                  <p class="text-xs text-ink-600 mt-0.5">
                    Você será o organizador e poderá convidar os participantes pelo link.
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

              <div class="flex flex-wrap gap-2">
                @for (suggestion of groupNameSuggestions; track suggestion) {
                  <button
                    type="button"
                    (click)="applyEventSuggestion(suggestion)"
                    class="min-h-11 px-3 py-1.5 rounded-full bg-festive-cream hover:bg-gold-50 border border-festive-border hover:border-gold-300 text-xs font-semibold text-ink-900 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    + {{ suggestion }}
                  </button>
                }
              </div>

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
                      <span>Criando grupo...</span>
                    } @else {
                      <span>Criar Grupo</span>
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

  readonly authMode = signal<'register' | 'login'>('register');
  readonly showRegPin = signal<boolean>(false);
  readonly showLoginPin = signal<boolean>(false);
  readonly myGroups = signal<GroupSummaryView[]>([]);
  readonly isSubmitting = signal<boolean>(false);
  readonly creatingGroup = signal<boolean>(false);
  readonly isCreateGroupModalOpen = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly statusMessage = signal<string | null>(null);

  readonly groupNameSuggestions = [
    'Natal da Família 2026',
    'Amigo Secreto dos Primos',
    'Ceia de Natal em Casa'
  ] as const;

  private usernameManuallyEdited = false;

  readonly registerForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    username: ['', [Validators.required, Validators.pattern(/^[a-z0-9._-]{3,30}$/)]],
    pin: ['', [Validators.required, Validators.pattern(/^\d{4,6}$/)]]
  });

  readonly loginForm = this.fb.group({
    username: ['', [Validators.required, Validators.pattern(/^[a-z0-9._-]{3,30}$/)]],
    pin: ['', [Validators.required, Validators.pattern(/^\d{4,6}$/)]]
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

  applyEventSuggestion(suggestion: string): void {
    this.createGroupForm.controls.eventName.setValue(suggestion);
  }

  setAuthMode(mode: 'register' | 'login'): void {
    this.authMode.set(mode);
    this.errorMessage.set(null);
  }

  onNameInput(): void {
    if (this.usernameManuallyEdited) {
      return;
    }
    const rawName = this.registerForm.controls.name.value;
    const suggested = HomeGroupsPageComponent.suggestUsername(rawName);
    this.registerForm.controls.username.setValue(suggested, { emitEvent: false });
  }

  onUsernameManualEdit(): void {
    this.usernameManuallyEdited = true;
  }

  submitRegister(): void {
    this.errorMessage.set(null);
    const { name, username, pin } = this.registerForm.getRawValue();
    const trimmedName = name.trim();
    const normalizedUsername = username.trim().toLowerCase();

    if (
      trimmedName.length < 2 ||
      trimmedName.length > 60 ||
      !/^[a-z0-9._-]{3,30}$/.test(normalizedUsername) ||
      !/^\d{4,6}$/.test(pin)
    ) {
      this.errorMessage.set(
        'Preencha um nome válido (2-60 caracteres), username (3-30 caracteres) e PIN numérico de 4 a 6 dígitos.'
      );
      return;
    }

    this.isSubmitting.set(true);
    this.apiService
      .register({
        name: trimmedName,
        username: normalizedUsername,
        pin
      })
      .subscribe({
        next: (session) => {
          this.isSubmitting.set(false);
          this.showRegPin.set(false);
          this.registerForm.reset();
          this.usernameManuallyEdited = false;
          this.authStore.setSession(session);
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          if (err.status === 409) {
            this.errorMessage.set(
              'Este username já está em uso. Sugerimos adicionar um sobrenome ou número ao username.'
            );
          } else {
            this.errorMessage.set('Não foi possível concluir o cadastro. Verifique os dados informados.');
          }
        }
      });
  }

  submitLogin(): void {
    this.errorMessage.set(null);
    const { username, pin } = this.loginForm.getRawValue();
    const normalizedUsername = username.trim().toLowerCase();

    if (!/^[a-z0-9._-]{3,30}$/.test(normalizedUsername) || !/^\d{4,6}$/.test(pin)) {
      this.errorMessage.set('Informe seu username e um PIN numérico de 4 a 6 dígitos.');
      return;
    }

    this.isSubmitting.set(true);
    this.apiService
      .login({
        username: normalizedUsername,
        pin
      })
      .subscribe({
        next: (session) => {
          this.isSubmitting.set(false);
          this.showLoginPin.set(false);
          this.loginForm.reset();
          this.authStore.setSession(session);
        },
        error: () => {
          this.isSubmitting.set(false);
          this.errorMessage.set('Usuário ou PIN incorreto.');
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
    this.statusMessage.set(null);
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
        this.statusMessage.set(`Grupo "${created.eventName}" criado com sucesso!`);
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
    this.authStore.switchFamilyUser();
    this.myGroups.set([]);
    this.isCreateGroupModalOpen.set(false);
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    this.showRegPin.set(false);
    this.showLoginPin.set(false);
    this.registerForm.reset();
    this.loginForm.reset();
    this.usernameManuallyEdited = false;
    this.authMode.set('register');
  }

  static suggestUsername(rawName: string): string {
    return rawName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 30);
  }
}
