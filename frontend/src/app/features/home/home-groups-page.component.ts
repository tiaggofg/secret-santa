import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';
import { GroupSummaryView } from '../../core/api/secret-santa-api.models';
import { AuthSessionStore } from '../../core/auth/auth-session.store';
import { BrowserGeolocationService } from '../../core/geolocation/browser-geolocation.service';
import { DeviceSessionGeoStore } from '../../core/geolocation/device-session-geo.store';

@Component({
  selector: 'app-home-groups-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      @if (!authStore.isAuthenticated()) {
        <section class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div class="space-y-1">
            <h1 class="text-xl font-bold text-slate-900">Bem-vindo ao Amigo Secreto</h1>
            <p class="text-sm text-slate-600">
              Faça seu cadastro rápido ou entre com seu usuário e PIN numérico de 4 a 6 dígitos.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl" role="tablist">
            <button
              type="button"
              data-testid="tab-register"
              (click)="setAuthMode('register')"
              [class]="
                authMode() === 'register'
                  ? 'min-h-12 rounded-lg bg-white text-emerald-800 font-semibold shadow-sm text-sm'
                  : 'min-h-12 rounded-lg text-slate-700 font-medium text-sm'
              "
            >
              Criar Cadastro
            </button>
            <button
              type="button"
              data-testid="tab-login"
              (click)="setAuthMode('login')"
              [class]="
                authMode() === 'login'
                  ? 'min-h-12 rounded-lg bg-white text-emerald-800 font-semibold shadow-sm text-sm'
                  : 'min-h-12 rounded-lg text-slate-700 font-medium text-sm'
              "
            >
              Já tenho conta
            </button>
          </div>

          @if (errorMessage()) {
            <div
              role="alert"
              data-testid="auth-error"
              class="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800 font-medium"
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
                <label for="reg-name" class="block text-sm font-semibold text-slate-800 mb-1">
                  Seu Nome
                </label>
                <input
                  id="reg-name"
                  type="text"
                  formControlName="name"
                  (input)="onNameInput()"
                  placeholder="Ex: Maria Silva"
                  class="w-full min-h-12 rounded-xl border border-slate-300 px-3.5 py-2.5 text-base focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label for="reg-username" class="block text-sm font-semibold text-slate-800 mb-1">
                  Nome de Usuário (username)
                </label>
                <input
                  id="reg-username"
                  type="text"
                  formControlName="username"
                  (input)="onUsernameManualEdit()"
                  placeholder="Ex: maria.silva"
                  autocapitalize="none"
                  class="w-full min-h-12 rounded-xl border border-slate-300 px-3.5 py-2.5 text-base lowercase focus:border-emerald-600 focus:outline-none"
                />
                <p class="text-xs text-slate-500 mt-1">
                  3 a 30 caracteres (letras minúsculas, números, ponto, hífen ou underline).
                </p>
              </div>

              <div>
                <label for="reg-pin" class="block text-sm font-semibold text-slate-800 mb-1">
                  PIN Numérico (4 a 6 dígitos)
                </label>
                <input
                  id="reg-pin"
                  type="password"
                  inputmode="numeric"
                  maxlength="6"
                  formControlName="pin"
                  placeholder="Ex: 1234"
                  class="w-full min-h-12 rounded-xl border border-slate-300 px-3.5 py-2.5 text-lg tracking-widest focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                data-testid="register-submit"
                [disabled]="isSubmitting()"
                class="w-full min-h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-base shadow-sm transition"
              >
                Cadastrar e Ver Grupos
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
                <label for="login-username" class="block text-sm font-semibold text-slate-800 mb-1">
                  Seu Username
                </label>
                <input
                  id="login-username"
                  type="text"
                  formControlName="username"
                  placeholder="Ex: maria.silva"
                  autocapitalize="none"
                  class="w-full min-h-12 rounded-xl border border-slate-300 px-3.5 py-2.5 text-base lowercase focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label for="login-pin" class="block text-sm font-semibold text-slate-800 mb-1">
                  Seu PIN (4 a 6 dígitos)
                </label>
                <input
                  id="login-pin"
                  type="password"
                  inputmode="numeric"
                  maxlength="6"
                  formControlName="pin"
                  placeholder="••••"
                  class="w-full min-h-12 rounded-xl border border-slate-300 px-3.5 py-2.5 text-lg tracking-widest focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                data-testid="login-submit"
                [disabled]="isSubmitting()"
                class="w-full min-h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-base shadow-sm transition"
              >
                Entrar
              </button>
            </form>
          }
        </section>
      } @else {
        <!-- Authenticated View -->
        <section class="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Conectado como
              </p>
              <p class="text-lg font-bold text-slate-900">
                {{ authStore.name() }}
                <span class="text-sm font-normal text-slate-600">&#64;{{ authStore.username() }}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="switch-family-user-btn"
            (click)="onSwitchFamilyUser()"
            class="w-full min-h-12 rounded-xl bg-white border border-emerald-400 hover:bg-emerald-100 text-emerald-900 font-semibold text-sm px-3 py-2 flex items-center justify-center gap-2 shadow-sm transition"
          >
            <span>Cadastrar outro familiar / Trocar de usuário neste aparelho</span>
          </button>
        </section>

        @if (geoFallbackWarning()) {
          <div
            role="status"
            data-testid="geo-fallback-notice"
            class="rounded-xl bg-amber-50 border border-amber-300 p-3.5 text-sm text-amber-900"
          >
            Inscrição concluída sem GPS: a restrição residencial automática de 50 metros não será aplicada a este cadastro.
          </div>
        }

        @if (statusMessage()) {
          <div
            role="status"
            data-testid="status-message"
            class="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 font-medium"
          >
            {{ statusMessage() }}
          </div>
        }

        @if (errorMessage()) {
          <div
            role="alert"
            data-testid="group-error"
            class="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800 font-medium"
          >
            {{ errorMessage() }}
          </div>
        }

        <!-- Available Groups Section -->
        <section class="space-y-3" data-testid="available-groups-section">
          <h2 class="text-lg font-bold text-slate-900">Grupos Disponíveis (Abertos)</h2>

          @if (availableGroups().length === 0) {
            <p class="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
              Nenhum grupo aberto disponível para entrar no momento.
            </p>
          } @else {
            <div class="space-y-3">
              @for (group of availableGroups(); track group.slug) {
                <div
                  data-testid="available-group-card"
                  class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3"
                >
                  <div>
                    <h3 class="font-bold text-slate-900 text-base">{{ group.eventName }}</h3>
                    <p class="text-xs text-slate-600">
                      {{ group.participantCount }} participante(s) • Aberto para inscrições
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="join-group-btn"
                    [disabled]="isSubmitting()"
                    (click)="joinAvailableGroup(group.slug)"
                    class="min-h-12 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-sm shrink-0 shadow-sm"
                  >
                    Participar
                  </button>
                </div>
              }
            </div>
          }
        </section>

        <!-- My Groups Section -->
        <section class="space-y-3" data-testid="my-groups-section">
          <h2 class="text-lg font-bold text-slate-900">Meus Grupos</h2>

          @if (myGroups().length === 0) {
            <p class="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
              Você ainda não participa nem organiza nenhum grupo.
            </p>
          } @else {
            <div class="space-y-3">
              @for (group of myGroups(); track group.slug) {
                <div
                  data-testid="my-group-card"
                  class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <h3 class="font-bold text-slate-900 text-base">{{ group.eventName }}</h3>
                      <p class="text-xs text-slate-600">
                        {{ group.participantCount }} participante(s) •
                        {{ group.status === 'DRAWN' ? 'Sorteio realizado' : 'Aguardando sorteio' }}
                      </p>
                    </div>
                    @if (group.organizer) {
                      <span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                        Organizador
                      </span>
                    }
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <a
                      [routerLink]="['/g', group.slug]"
                      data-testid="open-group-link"
                      class="flex-1 min-h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold text-sm flex items-center justify-center px-3"
                    >
                      {{ group.status === 'DRAWN' ? 'Ver Amigo Secreto' : 'Ver Grupo' }}
                    </a>
                    @if (group.organizer) {
                      <a
                        [routerLink]="['/g', group.slug, 'admin']"
                        data-testid="open-admin-link"
                        class="flex-1 min-h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm flex items-center justify-center px-3"
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

        <!-- Create New Group Section -->
        <section class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <h2 class="text-lg font-bold text-slate-900">Criar Novo Grupo</h2>
          <form
            [formGroup]="createGroupForm"
            (ngSubmit)="submitCreateGroup()"
            data-testid="create-group-form"
            class="space-y-3"
          >
            <div>
              <label for="event-name" class="block text-sm font-semibold text-slate-800 mb-1">
                Nome do Evento (3 a 100 caracteres)
              </label>
              <input
                id="event-name"
                type="text"
                formControlName="eventName"
                placeholder="Ex: Natal da Família Silva"
                class="w-full min-h-12 rounded-xl border border-slate-300 px-3.5 py-2.5 text-base focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              data-testid="create-group-submit"
              [disabled]="isSubmitting()"
              class="w-full min-h-12 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-sm shadow-sm transition"
            >
              Criar Grupo de Amigo Secreto
            </button>
          </form>
        </section>
      }
    </div>
  `
})
export class HomeGroupsPageComponent implements OnInit {
  readonly authStore = inject(AuthSessionStore);
  readonly geoStore = inject(DeviceSessionGeoStore);
  private readonly apiService = inject(SecretSantaApiService);
  private readonly geoService = inject(BrowserGeolocationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly authMode = signal<'register' | 'login'>('register');
  readonly myGroups = signal<GroupSummaryView[]>([]);
  readonly availableGroups = signal<GroupSummaryView[]>([]);
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly statusMessage = signal<string | null>(null);
  readonly geoFallbackWarning = signal<boolean>(false);

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
        this.availableGroups.set(discovery.availableGroups);
      },
      error: () => {
        this.errorMessage.set('Erro ao carregar a lista de grupos.');
      }
    });
  }

  async joinAvailableGroup(slug: string): Promise<void> {
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    this.isSubmitting.set(true);

    const geo = await this.geoService.captureCoordinatesForJoin();
    if (geo.fallbackUsed) {
      this.geoFallbackWarning.set(true);
    }

    this.apiService
      .joinGroup(slug, {
        latitude: geo.latitude,
        longitude: geo.longitude
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.statusMessage.set('Você entrou no grupo com sucesso!');
          this.loadGroups();
        },
        error: () => {
          this.isSubmitting.set(false);
          this.errorMessage.set('Não foi possível entrar neste grupo.');
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
    this.apiService.createGroup({ eventName }).subscribe({
      next: (created) => {
        this.isSubmitting.set(false);
        this.createGroupForm.reset();
        this.statusMessage.set(`Grupo "${created.eventName}" criado com sucesso!`);
        this.loadGroups();
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Não foi possível criar o grupo.');
      }
    });
  }

  onSwitchFamilyUser(): void {
    this.authStore.switchFamilyUser();
    this.myGroups.set([]);
    this.availableGroups.set([]);
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    this.geoFallbackWarning.set(false);
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
