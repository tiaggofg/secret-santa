import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';
import {
  PublicGroupView,
  PublicParticipantView
} from '../../core/api/secret-santa-api.models';
import { AuthSessionStore } from '../../core/auth/auth-session.store';
import { BrowserGeolocationService } from '../../core/geolocation/browser-geolocation.service';
import { DeviceSessionGeoStore } from '../../core/geolocation/device-session-geo.store';
import { EphemeralRevealModalComponent } from './ephemeral-reveal-modal.component';
import { FestiveIconComponent } from '../../shared/components/festive-icon.component';
import { PasswordCriteriaIndicatorComponent } from '../../shared/components/password-criteria-indicator.component';
import { formatParticipantCount, getAvatarTone, getInitials, suggestUsername } from '../../shared/formatters';
import { evaluatePasswordCriteria, strongPasswordValidator } from '../../shared/password-policy';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-public-group-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    EphemeralRevealModalComponent,
    FestiveIconComponent,
    PasswordCriteriaIndicatorComponent
  ],
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
          @if (g.organizer) {
            <a
              [routerLink]="['/g', g.id, 'admin']"
              data-testid="organizer-admin-link"
              class="min-h-11 text-sm font-bold text-pine-800 hover:underline inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg px-1"
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
          class="rounded-2xl bg-cranberry-50 border border-cranberry-200 p-3.5 text-sm text-cranberry-800 font-medium break-words"
        >
          {{ errorMessage() }}
        </div>
      }

      @if (capturingGeo()) {
        <div
          role="status"
          class="rounded-2xl bg-gold-50 border border-gold-200 p-3.5 text-sm text-gold-900 font-medium flex items-center gap-2.5"
        >
          <app-festive-icon name="spinner" svgClass="w-5 h-5 text-gold-600" />
          <span>Verificando localização da casa...</span>
        </div>
      }

      @if (group(); as g) {
        <!-- Festive Invitation Card -->
        <section class="bg-festive-card border border-festive-border rounded-3xl p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 space-y-1">
              <span class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-pine-800">
                <app-festive-icon name="pine" svgClass="w-3.5 h-3.5 text-pine-800" />
                Convite de Natal
              </span>
              <h1 class="font-display text-2xl font-bold text-ink-900 break-words leading-tight">
                {{ g.eventName }}
              </h1>
            </div>
            <span
              data-testid="public-group-status-badge"
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

          <div class="flex flex-wrap items-center gap-2 pt-1">
            <span class="text-xs font-semibold text-ink-600 tabular-nums">
              {{ participantCountLabel(g.participantCount) }}
            </span>
            @if (g.status === 'OPEN' && g.participantCount < 3) {
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gold-50 border border-gold-200 text-gold-900 text-xs font-semibold">
                {{ missingParticipantsLabel(g.participantCount) }}
              </span>
            }
          </div>
        </section>

        @if (g.status === 'OPEN') {
          @if (!g.joined && !g.organizer && !g.inviteValid) {
            <!-- Blocked when invite link signature is missing or invalid -->
            <section
              data-testid="invalid-invite-notice"
              class="bg-cranberry-50 border border-cranberry-200 rounded-3xl p-5 shadow-sm space-y-2 text-cranberry-900"
            >
              <div class="flex items-center gap-2 font-display font-bold text-base text-cranberry-900">
                <app-festive-icon name="shield-eye" svgClass="w-5 h-5 text-cranberry-700 shrink-0" />
                <span>Convite Oficial Necessário</span>
              </div>
              <p class="text-sm text-cranberry-800 leading-relaxed">
                Este grupo é privado. Para participar, acesse através do link de convite oficial enviado pelo organizador.
              </p>
            </section>
          } @else if (!authStore.isAuthenticated()) {
            <!-- OPEN STATE: Direct WhatsApp link join for visitor with valid invite -->
            <section
              data-testid="whatsapp-visitor-join-section"
              class="bg-festive-card border border-festive-border rounded-3xl p-5 shadow-sm space-y-4"
            >
              <div class="space-y-1.5">
                <h2 class="font-display text-lg font-bold text-ink-900">
                  Você foi convidado para este Amigo Secreto!
                </h2>
                <p class="text-xs text-ink-600 leading-relaxed">
                  Entre com sua conta ou faça um cadastro rápido para participar de "{{ g.eventName }}".
                </p>
                <p class="text-xs text-pine-800 font-medium flex items-center gap-1.5">
                  <app-festive-icon name="gps" svgClass="w-3.5 h-3.5 shrink-0" />
                  <span>Usamos sua localização só para evitar tirar quem mora na mesma casa</span>
                </p>
              </div>

              @if (visitorMode() === 'login') {
                <form
                  [formGroup]="visitorLoginForm"
                  (ngSubmit)="submitVisitorLoginAndJoin()"
                  data-testid="visitor-login-form"
                  class="space-y-4"
                >
                  <div>
                    <label for="vis-login-username" class="block text-sm font-semibold text-ink-900 mb-1.5">
                      Seu nome de usuário
                    </label>
                    <input
                      id="vis-login-username"
                      type="text"
                      formControlName="username"
                      placeholder="Ex: maria.silva"
                      autocapitalize="none"
                      class="w-full min-h-12 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base lowercase text-ink-900 focus:border-pine-800 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label for="vis-login-password" class="block text-sm font-semibold text-ink-900 mb-1.5">
                      Sua senha
                    </label>
                    <div class="relative flex items-center">
                      <input
                        id="vis-login-password"
                        [type]="showVisitorLoginPassword() ? 'text' : 'password'"
                        formControlName="password"
                        autocomplete="current-password"
                        placeholder="Digite sua senha"
                        class="w-full min-h-12 rounded-xl border border-stone-300 bg-white pl-3.5 pr-12 py-2.5 text-base text-ink-900 focus:border-pine-800 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                      />
                      <button
                        type="button"
                        (click)="showVisitorLoginPassword.set(!showVisitorLoginPassword())"
                        aria-label="Mostrar ou ocultar senha"
                        class="absolute right-1 min-w-11 min-h-11 rounded-lg flex items-center justify-center text-ink-600 hover:text-pine-900 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                      >
                        <app-festive-icon [name]="showVisitorLoginPassword() ? 'eye-off' : 'eye'" svgClass="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    data-testid="visitor-login-join-btn"
                    [disabled]="isSubmitting()"
                    class="w-full min-h-12 rounded-xl bg-pine-800 hover:bg-pine-900 disabled:opacity-60 text-white font-bold text-base shadow-sm transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    @if (isSubmitting()) {
                      <app-festive-icon name="spinner" svgClass="w-5 h-5" />
                      <span>Verificando localização da casa...</span>
                    } @else {
                      <span>Entrar e Participar do Grupo</span>
                    }
                  </button>
                </form>

                <div class="pt-2 border-t border-festive-border text-center">
                  <button
                    type="button"
                    data-testid="visitor-go-to-register-link"
                    (click)="setVisitorMode('register')"
                    class="inline-flex items-center justify-center min-h-11 text-sm font-semibold text-pine-800 hover:text-pine-950 underline underline-offset-4"
                  >
                    Não tem uma conta? Clique aqui
                  </button>
                </div>
              } @else {
                <form
                  [formGroup]="visitorRegisterForm"
                  (ngSubmit)="submitVisitorRegisterAndJoin()"
                  data-testid="visitor-register-form"
                  class="space-y-4"
                >
                  <div>
                    <label for="vis-name" class="block text-sm font-semibold text-ink-900 mb-1.5">
                      Nome
                    </label>
                    <input
                      id="vis-name"
                      type="text"
                      formControlName="name"
                      (input)="onVisitorNameInput()"
                      placeholder="Ex: Joãozinho Silva"
                      class="w-full min-h-12 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base text-ink-900 focus:border-pine-800 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label for="vis-username" class="block text-sm font-semibold text-ink-900 mb-1.5">
                      Nome de usuário
                    </label>
                    <input
                      id="vis-username"
                      type="text"
                      formControlName="username"
                      (input)="onVisitorUsernameManualEdit()"
                      placeholder="Ex: joaozinho.silva"
                      autocapitalize="none"
                      class="w-full min-h-12 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base lowercase text-ink-900 focus:border-pine-800 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label for="vis-password" class="block text-sm font-semibold text-ink-900 mb-1.5">
                      Crie sua senha
                    </label>
                    <div class="relative flex items-center">
                      <input
                        id="vis-password"
                        [type]="showVisitorRegPassword() ? 'text' : 'password'"
                        formControlName="password"
                        autocomplete="new-password"
                        placeholder="Ex: Natal@2026"
                        class="w-full min-h-12 rounded-xl border border-stone-300 bg-white pl-3.5 pr-12 py-2.5 text-base text-ink-900 focus:border-pine-800 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                      />
                      <button
                        type="button"
                        (click)="showVisitorRegPassword.set(!showVisitorRegPassword())"
                        aria-label="Mostrar ou ocultar senha"
                        class="absolute right-1 min-w-11 min-h-11 rounded-lg flex items-center justify-center text-ink-600 hover:text-pine-900 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                      >
                        <app-festive-icon [name]="showVisitorRegPassword() ? 'eye-off' : 'eye'" svgClass="w-5 h-5" />
                      </button>
                    </div>
                    <app-password-criteria-indicator [password]="visitorRegisterForm.controls.password.value" />
                  </div>

                  <button
                    type="submit"
                    data-testid="visitor-register-join-btn"
                    [disabled]="isSubmitting()"
                    class="w-full min-h-12 rounded-xl bg-pine-800 hover:bg-pine-900 disabled:opacity-60 text-white font-bold text-base shadow-sm transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    @if (isSubmitting()) {
                      <app-festive-icon name="spinner" svgClass="w-5 h-5" />
                      <span>Verificando localização da casa...</span>
                    } @else {
                      <span>Continuar</span>
                    }
                  </button>
                </form>

                <div class="pt-2 border-t border-festive-border text-center">
                  <button
                    type="button"
                    data-testid="visitor-go-to-login-link"
                    (click)="setVisitorMode('login')"
                    class="inline-flex items-center justify-center min-h-11 text-sm font-semibold text-pine-800 hover:text-pine-950 underline underline-offset-4"
                  >
                    Já tem uma conta? Entrar
                  </button>
                </div>
              }
            </section>
          } @else {
            <!-- Authenticated user on OPEN group -->
            <section class="bg-pine-50 border border-pine-200 rounded-3xl p-5 space-y-4">
              @if (!g.joined) {
                <p class="text-sm text-ink-900">
                  Olá, <strong>{{ authStore.name() }}</strong>. Toque abaixo para confirmar sua participação neste grupo:
                </p>

                <button
                  type="button"
                  data-testid="authenticated-join-btn"
                  [disabled]="isSubmitting()"
                  (click)="joinWithCurrentAuthenticatedUser()"
                  class="w-full min-h-12 rounded-xl bg-pine-800 hover:bg-pine-900 disabled:opacity-60 text-white font-bold text-base shadow-sm transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  @if (isSubmitting()) {
                    <app-festive-icon name="spinner" svgClass="w-5 h-5" />
                    <span>Verificando localização da casa...</span>
                  } @else {
                    <span>Participar deste Grupo</span>
                  }
                </button>
              } @else {
                <div data-testid="already-joined-confirmation" class="space-y-1">
                  <p class="text-base font-bold text-pine-950 flex items-center gap-1.5">
                    <app-festive-icon name="check" svgClass="w-5 h-5 text-pine-700 shrink-0" />
                    <span>Você já está inscrito neste grupo, {{ currentParticipantDisplayName(g) }}!</span>
                  </p>
                  <p class="text-xs text-pine-800">
                    Aguarde o organizador realizar o sorteio.
                  </p>
                </div>
              }
            </section>
          }
        } @else {
          <!-- DRAWN STATE: Reveal Secret Friend with nome de usuário + PIN -->
          <section
            data-testid="reveal-form-section"
            class="bg-festive-card border border-festive-border rounded-3xl p-5 shadow-sm space-y-4"
          >
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <app-festive-icon name="gift-open" svgClass="w-5 h-5 text-cranberry-700" />
                <h2 class="font-display text-lg font-bold text-ink-900">Consultar Quem Eu Tirei</h2>
              </div>

              <!-- 3-step visual guide -->
              <div class="grid grid-cols-3 gap-1.5 text-center text-[11px] font-semibold">
                <div class="rounded-xl bg-festive-cream border border-festive-border p-2 text-ink-900">
                  1. Informe seu nome de usuário
                </div>
                <div class="rounded-xl bg-festive-cream border border-festive-border p-2 text-ink-900">
                  2. Digite sua senha
                </div>
                <div class="rounded-xl bg-cranberry-50 border border-cranberry-200 p-2 text-cranberry-800">
                  3. Abra seu presente
                </div>
              </div>
            </div>

            <form
              [formGroup]="revealForm"
              (ngSubmit)="submitReveal()"
              data-testid="reveal-form"
              class="space-y-4"
            >
              <div>
                <label for="reveal-username" class="block text-sm font-semibold text-ink-900 mb-1.5">
                  Seu nome de usuário
                </label>
                <input
                  id="reveal-username"
                  type="text"
                  formControlName="username"
                  placeholder="Ex: maria.silva"
                  autocapitalize="none"
                  class="w-full min-h-12 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base lowercase text-ink-900 focus:border-pine-800 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                />
              </div>

              <div>
                <label for="reveal-password" class="block text-sm font-semibold text-ink-900 mb-1.5">
                  Sua senha
                </label>
                <div class="relative flex items-center">
                  <input
                    id="reveal-password"
                    [type]="showRevealPassword() ? 'text' : 'password'"
                    formControlName="password"
                    autocomplete="current-password"
                    placeholder="Digite sua senha"
                    class="w-full min-h-12 rounded-xl border border-stone-300 bg-white pl-3.5 pr-12 py-2.5 text-base text-ink-900 focus:border-pine-800 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    (click)="showRevealPassword.set(!showRevealPassword())"
                    aria-label="Mostrar ou ocultar senha"
                    class="absolute right-1 min-w-11 min-h-11 rounded-lg flex items-center justify-center text-ink-600 hover:text-pine-900 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    <app-festive-icon [name]="showRevealPassword() ? 'eye-off' : 'eye'" svgClass="w-5 h-5" />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                data-testid="reveal-submit-btn"
                [disabled]="isSubmitting()"
                class="w-full min-h-12 rounded-xl bg-cranberry-700 hover:bg-cranberry-800 disabled:opacity-60 text-white font-bold text-base shadow-sm transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                @if (isSubmitting()) {
                  <app-festive-icon name="spinner" svgClass="w-5 h-5" />
                  <span>Abrindo presente...</span>
                } @else {
                  <app-festive-icon name="gift-open" svgClass="w-5 h-5" />
                  <span>Abrir Meu Presente</span>
                }
              </button>
            </form>
          </section>
        }

        <!-- Participant List (only visible to organizer or enrolled participants) -->
        @if (g.participantsVisible) {
          <section class="space-y-3" data-testid="public-participants-list">
            <h2 class="font-display text-lg font-bold text-ink-900">
              Participantes do Grupo ({{ g.participantCount }})
            </h2>

            @if (g.participants.length === 0) {
              <p class="text-sm text-ink-600 bg-white border border-festive-border rounded-2xl p-4">
                Seja o primeiro a participar deste grupo!
              </p>
            } @else {
              <div class="space-y-2.5">
                @for (p of g.participants; track p.id) {
                  @if (g.status === 'OPEN') {
                    <!-- Non-interactive informational card when OPEN -->
                    <div
                      data-testid="participant-list-item"
                      [attr.data-reveal-status]="p.revealStatus"
                      class="w-full bg-festive-card border border-festive-border rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-2.5"
                    >
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
                          <p class="font-bold text-ink-900 text-sm truncate">{{ p.name }}</p>
                          <p class="text-xs text-ink-600 truncate">&#64;{{ p.username }}</p>
                        </div>
                      </div>
                      <span
                        data-testid="public-participant-status"
                        [attr.data-reveal-status]="p.revealStatus"
                        class="px-2.5 py-1 rounded-full bg-pine-50 border border-pine-200 text-pine-800 text-xs font-semibold shrink-0"
                      >
                        Confirmado
                      </span>
                    </div>
                  } @else {
                    <!-- Interactive button to select participant when DRAWN -->
                    <button
                      type="button"
                      data-testid="participant-list-item"
                      [attr.data-reveal-status]="p.revealStatus"
                      (click)="onSelectParticipantFromList(p)"
                      [class]="
                        revealForm.controls.username.value === p.username
                          ? 'w-full min-h-[56px] text-left bg-gold-50/70 border-2 border-pine-800 rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500'
                          : 'w-full min-h-[56px] text-left bg-festive-card hover:bg-festive-cream border border-festive-border rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500'
                      "
                    >
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
                          <p class="font-bold text-ink-900 text-sm truncate">{{ p.name }}</p>
                          <p class="text-xs text-ink-600 truncate">&#64;{{ p.username }}</p>
                        </div>
                      </div>
                      <span
                        data-testid="public-participant-status"
                        [attr.data-reveal-status]="p.revealStatus"
                        [class]="
                          p.revealStatus === 'REVEALED'
                            ? 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-pine-100 text-pine-900 text-xs font-semibold shrink-0'
                            : 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gold-50 border border-gold-200 text-gold-900 text-xs font-medium shrink-0'
                        "
                      >
                        <app-festive-icon
                          [name]="p.revealStatus === 'REVEALED' ? 'gift-open' : 'gift'"
                          svgClass="w-3.5 h-3.5"
                        />
                        <span>{{ formatParticipantRevealStatus(p) }}</span>
                      </span>
                    </button>
                  }
                }
              </div>
            }
          </section>
        } @else {
          <section
            data-testid="private-participants-notice"
            class="bg-festive-card border border-festive-border rounded-2xl p-4 text-xs text-ink-600 leading-relaxed flex items-start gap-2.5"
          >
            <app-festive-icon name="shield-eye" svgClass="w-4 h-4 text-pine-800 shrink-0 mt-0.5" />
            <span>
              Este grupo é privado: a lista de participantes é exibida apenas para quem já está inscrito neste grupo.
            </span>
          </section>
        }
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
  private readonly router = inject(Router);
  private readonly apiService = inject(SecretSantaApiService);
  private readonly geoService = inject(BrowserGeolocationService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toastService = inject(ToastService);

  readonly group = signal<PublicGroupView | null>(null);
  readonly visitorMode = signal<'login' | 'register'>('login');
  readonly showVisitorRegPassword = signal<boolean>(false);
  readonly showVisitorLoginPassword = signal<boolean>(false);
  readonly showRevealPassword = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly capturingGeo = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly revealedFriendName = signal<string | null>(null);
  readonly revealedByUsername = signal<string | null>(null);

  private groupId = '';
  private inviteSignature = '';
  private visitorUsernameManuallyEdited = false;

  readonly visitorRegisterForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    username: ['', [Validators.required, Validators.pattern(/^[a-z0-9._-]{3,30}$/)]],
    password: ['', [Validators.required, strongPasswordValidator()]]
  });

  readonly visitorLoginForm = this.fb.group({
    username: ['', [Validators.required, Validators.pattern(/^[a-z0-9._-]{3,30}$/)]],
    password: ['', [Validators.required]]
  });

  readonly revealForm = this.fb.group({
    username: ['', [Validators.required, Validators.pattern(/^[a-z0-9._-]{3,30}$/)]],
    password: ['', [Validators.required]]
  });

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('groupId') ?? '';
    this.inviteSignature = this.route.snapshot.queryParamMap?.get('sig') ?? '';
    const loggedInUsername = this.authStore.username();
    if (loggedInUsername) {
      this.revealForm.controls.username.setValue(loggedInUsername);
    }
    if (this.groupId) {
      this.loadPublicGroup();
    }
  }

  ngOnDestroy(): void {
    this.revealedFriendName.set(null);
    this.revealedByUsername.set(null);
    this.revealForm.controls.password.setValue('');
  }

  participantCountLabel(count: number): string {
    return formatParticipantCount(count);
  }

  missingParticipantsLabel(count: number): string {
    const missing = Math.max(0, 3 - count);
    return missing === 1
      ? 'Falta 1 pessoa para o sorteio'
      : `Faltam ${missing} pessoas para o sorteio`;
  }

  initials(name: string): string {
    return getInitials(name);
  }

  avatarTone(name: string): string {
    return getAvatarTone(name);
  }

  currentParticipantDisplayName(g: PublicGroupView): string {
    const userId = this.authStore.userId();
    const username = this.authStore.username();
    const matched = g.participants.find(
      (p) => (userId && p.userId === userId) || (username && p.username === username)
    );
    return matched?.name ?? this.authStore.name() ?? username ?? '';
  }

  loadPublicGroup(): void {
    this.apiService.getPublicGroup(this.groupId, this.inviteSignature || undefined).subscribe({
      next: (g) => {
        this.group.set(g);
      },
      error: () => {
        this.errorMessage.set('Grupo não encontrado.');
      }
    });
  }

  setVisitorMode(mode: 'login' | 'register'): void {
    this.visitorMode.set(mode);
    this.errorMessage.set(null);
  }

  onVisitorNameInput(): void {
    if (this.visitorUsernameManuallyEdited) {
      return;
    }
    const rawName = this.visitorRegisterForm.controls.name.value;
    this.visitorRegisterForm.controls.username.setValue(suggestUsername(rawName), { emitEvent: false });
  }

  onVisitorUsernameManualEdit(): void {
    this.visitorUsernameManuallyEdited = true;
  }

  async submitVisitorRegisterAndJoin(): Promise<void> {
    this.errorMessage.set(null);
    const { name, username, password } = this.visitorRegisterForm.getRawValue();
    const trimmedName = name.trim();
    const normalizedUsername = username.trim().toLowerCase();

    if (
      trimmedName.length < 2 ||
      trimmedName.length > 60 ||
      !/^[a-z0-9._-]{3,30}$/.test(normalizedUsername) ||
      !evaluatePasswordCriteria(password).isValid
    ) {
      this.errorMessage.set(
        'Informe seu nome (2-60 caracteres), nome de usuário válido e uma senha forte que atenda aos critérios.'
      );
      return;
    }

    this.isSubmitting.set(true);
    this.capturingGeo.set(true);
    const geo = await this.geoService.captureCoordinatesForJoin();
    this.capturingGeo.set(false);
    if (geo.fallbackUsed) {
      this.toastService.warning(
        'Inscrição concluída sem GPS: a restrição residencial automática de 50 metros não será aplicada a este cadastro.'
      );
    }

    this.apiService
      .joinGroup(this.groupId, {
        name: trimmedName,
        username: normalizedUsername,
        password,
        inviteSignature: this.inviteSignature || undefined,
        latitude: geo.latitude,
        longitude: geo.longitude
      })
      .subscribe({
        next: (registration) => {
          this.isSubmitting.set(false);
          this.authStore.setSession({
            userId: registration.userId,
            name: registration.name,
            username: registration.username
          });
          this.showVisitorRegPassword.set(false);
          this.visitorRegisterForm.reset();
          this.visitorUsernameManuallyEdited = false;
          this.toastService.success('Cadastro e inscrição no grupo realizados com sucesso!');
          this.clearInviteQueryAndReload();
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          if (err.status === 403) {
            this.errorMessage.set(
              'Link de convite inválido ou expirado. Solicite o link oficial ao organizador do grupo.'
            );
          } else if (err.status === 409) {
            this.errorMessage.set(
              'Este nome de usuário já está cadastrado ou já participa do grupo. Use a opção "Já tem uma conta? Entrar".'
            );
          } else {
            this.errorMessage.set('Não foi possível concluir o cadastro e inscrição.');
          }
        }
      });
  }

  async submitVisitorLoginAndJoin(): Promise<void> {
    this.errorMessage.set(null);
    const { username, password } = this.visitorLoginForm.getRawValue();
    const normalizedUsername = username.trim().toLowerCase();

    if (!/^[a-z0-9._-]{3,30}$/.test(normalizedUsername) || !password) {
      this.errorMessage.set('Informe seu nome de usuário e sua senha.');
      return;
    }

    this.isSubmitting.set(true);
    this.capturingGeo.set(true);
    const geo = await this.geoService.captureCoordinatesForJoin();
    this.capturingGeo.set(false);
    if (geo.fallbackUsed) {
      this.toastService.warning(
        'Inscrição concluída sem GPS: a restrição residencial automática de 50 metros não será aplicada a este cadastro.'
      );
    }

    this.apiService
      .joinGroup(this.groupId, {
        username: normalizedUsername,
        password,
        inviteSignature: this.inviteSignature || undefined,
        latitude: geo.latitude,
        longitude: geo.longitude
      })
      .subscribe({
        next: (registration) => {
          this.isSubmitting.set(false);
          this.authStore.setSession({
            userId: registration.userId,
            name: registration.name,
            username: registration.username
          });
          this.showVisitorLoginPassword.set(false);
          this.visitorLoginForm.reset();
          this.toastService.success('Login e inscrição no grupo realizados com sucesso!');
          this.clearInviteQueryAndReload();
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          if (err.status === 403) {
            this.errorMessage.set(
              'Link de convite inválido ou expirado. Solicite o link oficial ao organizador do grupo.'
            );
          } else if (err.status === 401) {
            this.errorMessage.set('Nome de usuário ou senha incorretos.');
          } else if (err.status === 409) {
            this.handleAlreadyParticipantRedirect(err);
          } else {
            this.errorMessage.set('Não foi possível entrar no grupo.');
          }
        }
      });
  }

  private handleAlreadyParticipantRedirect(err: HttpErrorResponse): void {
    const body = err.error as { userId?: string; name?: string; username?: string } | null;
    if (body?.userId && body?.username) {
      this.authStore.setSession({
        userId: body.userId,
        name: body.name ?? body.username,
        username: body.username
      });
    } else {
      this.apiService.me().subscribe({
        next: (user) => this.authStore.setSession(user),
        error: () => {}
      });
    }
    this.showVisitorLoginPassword.set(false);
    this.visitorLoginForm.reset();
    this.toastService.success('Você já está inscrito neste grupo!');
    this.clearInviteQueryAndReload();
  }

  private clearInviteQueryAndReload(): void {
    this.inviteSignature = '';
    void this.router.navigate(['/g', this.groupId], { replaceUrl: true });
    this.loadPublicGroup();
  }

  async joinWithCurrentAuthenticatedUser(): Promise<void> {
    this.errorMessage.set(null);
    const currentGroup = this.group();
    const isOrganizer = currentGroup?.organizer ?? false;

    this.isSubmitting.set(true);
    this.capturingGeo.set(true);

    const geo = await this.geoService.captureCoordinatesForJoin();
    this.capturingGeo.set(false);
    if (geo.fallbackUsed) {
      this.toastService.warning(
        'Inscrição concluída sem GPS: a restrição residencial automática de 50 metros não será aplicada a este cadastro.'
      );
    }

    this.apiService
      .joinGroup(this.groupId, {
        inviteSignature: isOrganizer ? undefined : this.inviteSignature || undefined,
        latitude: geo.latitude,
        longitude: geo.longitude
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.toastService.success('Inscrição confirmada com sucesso!');
          this.clearInviteQueryAndReload();
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          if (err.status === 403) {
            this.errorMessage.set(
              'Link de convite inválido ou expirado. Solicite o link oficial ao organizador do grupo.'
            );
          } else if (err.status === 409) {
            this.toastService.success('Você já está inscrito neste grupo!');
            this.clearInviteQueryAndReload();
          } else {
            this.errorMessage.set('Não foi possível concluir sua inscrição.');
          }
        }
      });
  }

  onSelectParticipantFromList(participant: PublicParticipantView): void {
    this.revealForm.controls.username.setValue(participant.username);
    this.revealForm.controls.password.setValue('');
    this.errorMessage.set(null);
  }

  submitReveal(): void {
    this.errorMessage.set(null);
    const { username, password } = this.revealForm.getRawValue();
    const normalizedUsername = username.trim().toLowerCase();

    if (!/^[a-z0-9._-]{3,30}$/.test(normalizedUsername) || !password) {
      this.errorMessage.set('Informe o nome de usuário e sua senha.');
      return;
    }

    this.isSubmitting.set(true);
    this.apiService
      .revealMatch(this.groupId, {
        username: normalizedUsername,
        password
      })
      .subscribe({
        next: (result) => {
          this.isSubmitting.set(false);
          this.showRevealPassword.set(false);
          this.revealForm.controls.password.setValue('');
          this.revealedByUsername.set(result.username);
          this.revealedFriendName.set(result.drawnParticipantName);
          this.loadPublicGroup();
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          this.revealForm.controls.password.setValue('');
          if (err.status === 401) {
            this.errorMessage.set('Nome de usuário ou senha incorretos.');
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
    this.revealForm.controls.password.setValue('');
  }

  formatParticipantRevealStatus(participant: PublicParticipantView): string {
    switch (participant.revealStatus) {
      case 'REVEALED':
        return 'Já descobriu';
      case 'PENDING_REVEAL':
        return 'Ainda não espiou';
      default:
        return 'Confirmado';
    }
  }
}
