import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { switchMap } from 'rxjs';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';
import {
  PublicGroupView,
  PublicParticipantView
} from '../../core/api/secret-santa-api.models';
import { AuthSessionStore } from '../../core/auth/auth-session.store';
import { BrowserGeolocationService } from '../../core/geolocation/browser-geolocation.service';
import { DeviceSessionGeoStore } from '../../core/geolocation/device-session-geo.store';
import { EphemeralRevealModalComponent } from './ephemeral-reveal-modal.component';
import { HomeGroupsPageComponent } from '../home/home-groups-page.component';

@Component({
  selector: 'app-public-group-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, EphemeralRevealModalComponent],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <a
          routerLink="/"
          class="text-sm font-semibold text-emerald-800 hover:underline inline-flex items-center gap-1"
        >
          ← Ir para Todos os Grupos
        </a>
        @if (group(); as g) {
          @if (g.organizer) {
            <a
              [routerLink]="['/g', g.slug, 'admin']"
              data-testid="organizer-admin-link"
              class="text-sm font-bold text-emerald-800 hover:underline"
            >
              Painel do Organizador →
            </a>
          }
        }
      </div>

      @if (errorMessage()) {
        <div
          role="alert"
          data-testid="public-group-error"
          class="rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm text-red-800 font-medium"
        >
          {{ errorMessage() }}
        </div>
      }

      @if (statusMessage()) {
        <div
          role="status"
          data-testid="public-group-status"
          class="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-sm text-emerald-900 font-medium"
        >
          {{ statusMessage() }}
        </div>
      }

      @if (geoFallbackNotice()) {
        <div
          role="status"
          data-testid="public-geo-fallback-notice"
          class="rounded-xl bg-amber-50 border border-amber-300 p-3.5 text-sm text-amber-900"
        >
          Inscrição concluída sem GPS: a restrição residencial automática de 50 metros não será aplicada a este cadastro.
        </div>
      }

      @if (group(); as g) {
        <section class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Grupo de Amigo Secreto
              </span>
              <h1 class="text-xl font-bold text-slate-900">{{ g.eventName }}</h1>
            </div>
            <span
              data-testid="public-group-status-badge"
              [class]="
                g.status === 'DRAWN'
                  ? 'px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold'
                  : 'px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold'
              "
            >
              {{ g.status === 'DRAWN' ? 'Sorteio Realizado' : 'Inscrições Abertas' }}
            </span>
          </div>
          <p class="text-xs text-slate-600">
            {{ g.participants.length }} participante(s) inscrito(s)
          </p>
        </section>

        @if (g.status === 'OPEN') {
          <!-- OPEN STATE: Direct WhatsApp link join or authenticated 1-tap join -->
          @if (!authStore.isAuthenticated()) {
            <section
              data-testid="whatsapp-visitor-join-section"
              class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
            >
              <div class="space-y-1">
                <h2 class="text-lg font-bold text-slate-900">
                  Entrar em "{{ g.eventName }}"
                </h2>
                <p class="text-xs text-slate-600">
                  Crie seu cadastro básico (ou entre com sua conta) e você será inscrito automaticamente neste grupo.
                </p>
              </div>

              <div class="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl" role="tablist">
                <button
                  type="button"
                  data-testid="visitor-tab-register"
                  (click)="setVisitorMode('register')"
                  [class]="
                    visitorMode() === 'register'
                      ? 'min-h-12 rounded-lg bg-white text-emerald-800 font-semibold shadow-sm text-sm'
                      : 'min-h-12 rounded-lg text-slate-700 font-medium text-sm'
                  "
                >
                  Novo Cadastro
                </button>
                <button
                  type="button"
                  data-testid="visitor-tab-login"
                  (click)="setVisitorMode('login')"
                  [class]="
                    visitorMode() === 'login'
                      ? 'min-h-12 rounded-lg bg-white text-emerald-800 font-semibold shadow-sm text-sm'
                      : 'min-h-12 rounded-lg text-slate-700 font-medium text-sm'
                  "
                >
                  Já tenho conta
                </button>
              </div>

              @if (visitorMode() === 'register') {
                <form
                  [formGroup]="visitorRegisterForm"
                  (ngSubmit)="submitVisitorRegisterAndJoin()"
                  data-testid="visitor-register-form"
                  class="space-y-4"
                >
                  <div>
                    <label for="vis-name" class="block text-sm font-semibold text-slate-800 mb-1">
                      Nome
                    </label>
                    <input
                      id="vis-name"
                      type="text"
                      formControlName="name"
                      (input)="onVisitorNameInput()"
                      placeholder="Ex: Joãozinho Silva"
                      class="w-full min-h-12 rounded-xl border border-slate-300 px-3.5 py-2.5 text-base focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label for="vis-username" class="block text-sm font-semibold text-slate-800 mb-1">
                      Username
                    </label>
                    <input
                      id="vis-username"
                      type="text"
                      formControlName="username"
                      (input)="onVisitorUsernameManualEdit()"
                      placeholder="Ex: joaozinho.silva"
                      autocapitalize="none"
                      class="w-full min-h-12 rounded-xl border border-slate-300 px-3.5 py-2.5 text-base lowercase focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label for="vis-pin" class="block text-sm font-semibold text-slate-800 mb-1">
                      PIN Numérico (4 a 6 dígitos)
                    </label>
                    <input
                      id="vis-pin"
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
                    data-testid="visitor-register-join-btn"
                    [disabled]="isSubmitting()"
                    class="w-full min-h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-base shadow-sm transition"
                  >
                    Cadastrar e Participar do Grupo
                  </button>
                </form>
              } @else {
                <form
                  [formGroup]="visitorLoginForm"
                  (ngSubmit)="submitVisitorLoginAndJoin()"
                  data-testid="visitor-login-form"
                  class="space-y-4"
                >
                  <div>
                    <label for="vis-login-username" class="block text-sm font-semibold text-slate-800 mb-1">
                      Username
                    </label>
                    <input
                      id="vis-login-username"
                      type="text"
                      formControlName="username"
                      placeholder="Ex: maria.silva"
                      autocapitalize="none"
                      class="w-full min-h-12 rounded-xl border border-slate-300 px-3.5 py-2.5 text-base lowercase focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label for="vis-login-pin" class="block text-sm font-semibold text-slate-800 mb-1">
                      PIN (4 a 6 dígitos)
                    </label>
                    <input
                      id="vis-login-pin"
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
                    data-testid="visitor-login-join-btn"
                    [disabled]="isSubmitting()"
                    class="w-full min-h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-base shadow-sm transition"
                  >
                    Entrar e Participar do Grupo
                  </button>
                </form>
              }
            </section>
          } @else {
            <!-- Authenticated user on OPEN group -->
            <section class="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-4">
              @if (!g.joined) {
                <p class="text-sm text-slate-800">
                  Olá, <strong>{{ authStore.name() }}</strong> (&#64;{{ authStore.username() }}). Toque abaixo para confirmar sua participação neste grupo:
                </p>
                <button
                  type="button"
                  data-testid="authenticated-join-btn"
                  [disabled]="isSubmitting()"
                  (click)="joinWithCurrentAuthenticatedUser()"
                  class="w-full min-h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-base shadow-sm transition"
                >
                  Participar deste Grupo
                </button>
              } @else {
                <div data-testid="already-joined-confirmation" class="space-y-1">
                  <p class="text-base font-bold text-emerald-950">
                    Você já está inscrito neste grupo, {{ authStore.name() }}!
                  </p>
                  <p class="text-xs text-emerald-800">
                    Aguarde o organizador realizar o sorteio ou cadastre outro familiar (ex: filho/dependente) neste mesmo celular.
                  </p>
                </div>
              }

              <button
                type="button"
                data-testid="public-switch-family-user-btn"
                (click)="onSwitchFamilyUser()"
                class="w-full min-h-12 rounded-xl bg-white border border-emerald-400 hover:bg-emerald-100 text-emerald-900 font-semibold text-sm px-3 py-2 shadow-sm transition"
              >
                Cadastrar outro familiar / Trocar de usuário neste aparelho
              </button>
            </section>
          }
        } @else {
          <!-- DRAWN STATE: Reveal Secret Friend with username + PIN -->
          <section
            data-testid="reveal-form-section"
            class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
          >
            <div class="space-y-1">
              <h2 class="text-lg font-bold text-slate-900">Consultar Quem Eu Tirei</h2>
              <p class="text-xs text-slate-600">
                Toque no seu nome na lista abaixo ou digite seu username e seu PIN numérico de 4 a 6 dígitos para revelar seu Amigo Secreto.
              </p>
            </div>

            <form
              [formGroup]="revealForm"
              (ngSubmit)="submitReveal()"
              data-testid="reveal-form"
              class="space-y-4"
            >
              <div>
                <label for="reveal-username" class="block text-sm font-semibold text-slate-800 mb-1">
                  Seu Username
                </label>
                <input
                  id="reveal-username"
                  type="text"
                  formControlName="username"
                  placeholder="Ex: maria.silva"
                  autocapitalize="none"
                  class="w-full min-h-12 rounded-xl border border-slate-300 px-3.5 py-2.5 text-base lowercase focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label for="reveal-pin" class="block text-sm font-semibold text-slate-800 mb-1">
                  Seu PIN (4 a 6 dígitos)
                </label>
                <input
                  id="reveal-pin"
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
                data-testid="reveal-submit-btn"
                [disabled]="isSubmitting()"
                class="w-full min-h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-base shadow-sm transition"
              >
                Revelar Meu Amigo Secreto
              </button>
            </form>
          </section>
        }

        <!-- Participant List -->
        <section class="space-y-3" data-testid="public-participants-list">
          <h2 class="text-lg font-bold text-slate-900">
            Participantes do Grupo ({{ g.participants.length }})
          </h2>

          @if (g.participants.length === 0) {
            <p class="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
              Seja o primeiro a participar deste grupo!
            </p>
          } @else {
            <div class="space-y-2">
              @for (p of g.participants; track p.id) {
                <button
                  type="button"
                  data-testid="participant-list-item"
                  (click)="onSelectParticipantFromList(p)"
                  class="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-2 transition"
                >
                  <div>
                    <p class="font-bold text-slate-900 text-sm">{{ p.name }}</p>
                    <p class="text-xs text-slate-600">&#64;{{ p.username }}</p>
                  </div>
                  <span
                    data-testid="public-participant-status"
                    [class]="
                      p.revealStatus === 'REVEALED'
                        ? 'px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold'
                        : 'px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium'
                    "
                  >
                    {{ formatParticipantRevealStatus(p) }}
                  </span>
                </button>
              }
            </div>
          }
        </section>
      }

      <app-ephemeral-reveal-modal
        [drawnParticipantName]="revealedFriendName()"
        [username]="revealedByUsername()"
        (closed)="onModalClosed()"
      />
    </div>
  `
})
export class PublicGroupPageComponent implements OnInit, OnDestroy {
  readonly authStore = inject(AuthSessionStore);
  readonly geoStore = inject(DeviceSessionGeoStore);
  private readonly route = inject(ActivatedRoute);
  private readonly apiService = inject(SecretSantaApiService);
  private readonly geoService = inject(BrowserGeolocationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly group = signal<PublicGroupView | null>(null);
  readonly visitorMode = signal<'register' | 'login'>('register');
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly statusMessage = signal<string | null>(null);
  readonly geoFallbackNotice = signal<boolean>(false);

  readonly revealedFriendName = signal<string | null>(null);
  readonly revealedByUsername = signal<string | null>(null);

  private slug = '';
  private visitorUsernameManuallyEdited = false;

  readonly visitorRegisterForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    username: ['', [Validators.required, Validators.pattern(/^[a-z0-9._-]{3,30}$/)]],
    pin: ['', [Validators.required, Validators.pattern(/^\d{4,6}$/)]]
  });

  readonly visitorLoginForm = this.fb.group({
    username: ['', [Validators.required, Validators.pattern(/^[a-z0-9._-]{3,30}$/)]],
    pin: ['', [Validators.required, Validators.pattern(/^\d{4,6}$/)]]
  });

  readonly revealForm = this.fb.group({
    username: ['', [Validators.required, Validators.pattern(/^[a-z0-9._-]{3,30}$/)]],
    pin: ['', [Validators.required, Validators.pattern(/^\d{4,6}$/)]]
  });

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
    const loggedInUsername = this.authStore.username();
    if (loggedInUsername) {
      this.revealForm.controls.username.setValue(loggedInUsername);
    }
    if (this.slug) {
      this.loadPublicGroup();
    }
  }

  ngOnDestroy(): void {
    this.revealedFriendName.set(null);
    this.revealedByUsername.set(null);
    this.revealForm.controls.pin.setValue('');
  }

  loadPublicGroup(): void {
    this.apiService.getPublicGroup(this.slug).subscribe({
      next: (g) => {
        this.group.set(g);
      },
      error: () => {
        this.errorMessage.set('Grupo não encontrado.');
      }
    });
  }

  setVisitorMode(mode: 'register' | 'login'): void {
    this.visitorMode.set(mode);
    this.errorMessage.set(null);
  }

  onVisitorNameInput(): void {
    if (this.visitorUsernameManuallyEdited) {
      return;
    }
    const rawName = this.visitorRegisterForm.controls.name.value;
    const suggested = HomeGroupsPageComponent.suggestUsername(rawName);
    this.visitorRegisterForm.controls.username.setValue(suggested, { emitEvent: false });
  }

  onVisitorUsernameManualEdit(): void {
    this.visitorUsernameManuallyEdited = true;
  }

  async submitVisitorRegisterAndJoin(): Promise<void> {
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    const { name, username, pin } = this.visitorRegisterForm.getRawValue();
    const trimmedName = name.trim();
    const normalizedUsername = username.trim().toLowerCase();

    if (
      trimmedName.length < 2 ||
      trimmedName.length > 60 ||
      !/^[a-z0-9._-]{3,30}$/.test(normalizedUsername) ||
      !/^\d{4,6}$/.test(pin)
    ) {
      this.errorMessage.set(
        'Informe seu nome (2-60 caracteres), username válido e PIN numérico de 4 a 6 dígitos.'
      );
      return;
    }

    this.isSubmitting.set(true);
    const geo = await this.geoService.captureCoordinatesForJoin();
    if (geo.fallbackUsed) {
      this.geoFallbackNotice.set(true);
    }

    this.apiService
      .register({
        name: trimmedName,
        username: normalizedUsername,
        pin
      })
      .pipe(
        switchMap((session) => {
          this.authStore.setSession(session);
          return this.apiService.joinGroup(this.slug, {
            latitude: geo.latitude,
            longitude: geo.longitude
          });
        })
      )
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.visitorRegisterForm.reset();
          this.visitorUsernameManuallyEdited = false;
          this.statusMessage.set('Cadastro e inscrição no grupo realizados com sucesso!');
          this.loadPublicGroup();
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          if (err.status === 409) {
            this.errorMessage.set(
              'Este username já está cadastrado ou já participa do grupo. Use a aba "Já tenho conta" ou adicione um sufixo.'
            );
          } else {
            this.errorMessage.set('Não foi possível concluir o cadastro e inscrição.');
          }
        }
      });
  }

  async submitVisitorLoginAndJoin(): Promise<void> {
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    const { username, pin } = this.visitorLoginForm.getRawValue();
    const normalizedUsername = username.trim().toLowerCase();

    if (!/^[a-z0-9._-]{3,30}$/.test(normalizedUsername) || !/^\d{4,6}$/.test(pin)) {
      this.errorMessage.set('Informe seu username e PIN numérico de 4 a 6 dígitos.');
      return;
    }

    this.isSubmitting.set(true);
    const geo = await this.geoService.captureCoordinatesForJoin();
    if (geo.fallbackUsed) {
      this.geoFallbackNotice.set(true);
    }

    this.apiService
      .login({
        username: normalizedUsername,
        pin
      })
      .pipe(
        switchMap((session) => {
          this.authStore.setSession(session);
          return this.apiService.joinGroup(this.slug, {
            latitude: geo.latitude,
            longitude: geo.longitude
          });
        })
      )
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.visitorLoginForm.reset();
          this.statusMessage.set('Login e inscrição no grupo realizados com sucesso!');
          this.loadPublicGroup();
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          if (err.status === 401) {
            this.errorMessage.set('Usuário ou PIN incorreto.');
          } else if (err.status === 409) {
            this.statusMessage.set('Você já está inscrito neste grupo!');
            this.loadPublicGroup();
          } else {
            this.errorMessage.set('Não foi possível entrar no grupo.');
          }
        }
      });
  }

  async joinWithCurrentAuthenticatedUser(): Promise<void> {
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    this.isSubmitting.set(true);

    const geo = await this.geoService.captureCoordinatesForJoin();
    if (geo.fallbackUsed) {
      this.geoFallbackNotice.set(true);
    }

    this.apiService
      .joinGroup(this.slug, {
        latitude: geo.latitude,
        longitude: geo.longitude
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.statusMessage.set('Inscrição confirmada com sucesso!');
          this.loadPublicGroup();
        },
        error: () => {
          this.isSubmitting.set(false);
          this.errorMessage.set('Não foi possível concluir sua inscrição.');
        }
      });
  }

  onSwitchFamilyUser(): void {
    this.authStore.switchFamilyUser();
    this.errorMessage.set(null);
    this.statusMessage.set(null);
    this.geoFallbackNotice.set(false);
    this.visitorRegisterForm.reset();
    this.visitorLoginForm.reset();
    this.visitorUsernameManuallyEdited = false;
    this.visitorMode.set('register');
    this.loadPublicGroup();
  }

  onSelectParticipantFromList(participant: PublicParticipantView): void {
    this.revealForm.controls.username.setValue(participant.username);
    this.revealForm.controls.pin.setValue('');
    this.errorMessage.set(null);
  }

  submitReveal(): void {
    this.errorMessage.set(null);
    const { username, pin } = this.revealForm.getRawValue();
    const normalizedUsername = username.trim().toLowerCase();

    if (!/^[a-z0-9._-]{3,30}$/.test(normalizedUsername) || !/^\d{4,6}$/.test(pin)) {
      this.errorMessage.set('Informe o username e o PIN numérico de 4 a 6 dígitos.');
      return;
    }

    this.isSubmitting.set(true);
    this.apiService
      .revealMatch(this.slug, {
        username: normalizedUsername,
        pin
      })
      .subscribe({
        next: (result) => {
          this.isSubmitting.set(false);
          this.revealForm.controls.pin.setValue('');
          this.revealedByUsername.set(result.username);
          this.revealedFriendName.set(result.drawnParticipantName);
          this.loadPublicGroup();
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          this.revealForm.controls.pin.setValue('');
          if (err.status === 401) {
            this.errorMessage.set('Usuário ou PIN incorreto.');
          } else if (err.status === 409) {
            this.errorMessage.set('O sorteio ainda não foi realizado.');
          } else {
            this.errorMessage.set('Não foi possível consultar o resultado.');
          }
        }
      });
  }

  onModalClosed(): void {
    this.revealedFriendName.set(null);
    this.revealedByUsername.set(null);
    this.revealForm.controls.pin.setValue('');
  }

  formatParticipantRevealStatus(participant: PublicParticipantView): string {
    switch (participant.revealStatus) {
      case 'REVEALED':
        return 'REVEALED (Já viu)';
      case 'PENDING_REVEAL':
        return 'PENDING_REVEAL (Falta ver)';
      default:
        return 'Inscrito';
    }
  }
}
