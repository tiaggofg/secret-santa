import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';
import { FestiveIconComponent } from '../../shared/components/festive-icon.component';
import { PasswordCriteriaIndicatorComponent } from '../../shared/components/password-criteria-indicator.component';
import { evaluatePasswordCriteria, strongPasswordValidator } from '../../shared/password-policy';

@Component({
  selector: 'app-reset-pin-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, FestiveIconComponent, PasswordCriteriaIndicatorComponent],
  template: `
    <div class="space-y-6">
      <div>
        <a
          routerLink="/"
          class="min-h-11 text-sm font-semibold text-pine-800 hover:underline inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg px-1"
        >
          ← Ir para Tela Inicial
        </a>
      </div>

      <section class="bg-festive-card border border-festive-border rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div class="space-y-2">
          <div class="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-gold-100 border border-gold-200 text-gold-600">
            <app-festive-icon name="key" svgClass="w-5 h-5" />
          </div>
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-gold-600">
              Recuperação de Acesso
            </span>
            <h1 class="font-display text-2xl font-bold text-ink-900 mt-0.5">Criar Nova Senha</h1>
            <p class="text-xs text-ink-600 leading-relaxed mt-1">
              Crie uma nova senha forte para sua conta. Este link é de uso único e garante sua privacidade no sorteio.
            </p>
          </div>
        </div>

        @if (errorMessage()) {
          <div
            role="alert"
            data-testid="reset-pin-error"
            class="rounded-2xl bg-cranberry-50 border border-cranberry-200 p-3.5 text-sm text-cranberry-800 font-medium break-words"
          >
            {{ errorMessage() }}
          </div>
        }

        @if (resetCompleted()) {
          <div
            role="status"
            data-testid="reset-pin-success"
            class="rounded-2xl bg-pine-50 border border-pine-200 p-4 space-y-3 animate-fade-slide-up"
          >
            <p class="text-base font-bold text-pine-950 flex items-center gap-1.5">
              <app-festive-icon name="check" svgClass="w-5 h-5 text-pine-700 shrink-0" />
              <span>Senha atualizada com sucesso para &#64;{{ updatedUsername() }}!</span>
            </p>
            <p class="text-xs text-pine-800 leading-relaxed">
              Agora você já pode entrar nos seus grupos ou abrir seu Amigo Secreto usando sua nova senha.
            </p>
            <a
              routerLink="/"
              data-testid="proceed-home-link"
              class="w-full min-h-12 rounded-xl bg-pine-800 hover:bg-pine-900 text-white font-bold text-sm flex items-center justify-center px-4 py-3 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              Ir para Meus Grupos
            </a>
          </div>
        } @else {
          <form
            [formGroup]="resetForm"
            (ngSubmit)="submitResetPassword()"
            data-testid="reset-pin-form"
            class="space-y-4"
          >
            <div>
              <label for="new-password" class="block text-sm font-semibold text-ink-900 mb-1.5">
                Nova senha
              </label>
              <div class="relative flex items-center">
                <input
                  id="new-password"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="newPassword"
                  autocomplete="new-password"
                  placeholder="Ex: Natal@2026"
                  class="w-full min-h-12 rounded-xl border border-stone-300 bg-white pl-3.5 pr-12 py-2.5 text-base text-ink-900 focus:border-pine-800 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                />
                <button
                  type="button"
                  (click)="showPassword.set(!showPassword())"
                  aria-label="Mostrar ou ocultar senha"
                  class="absolute right-1 min-w-11 min-h-11 rounded-lg flex items-center justify-center text-ink-600 hover:text-pine-900 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <app-festive-icon [name]="showPassword() ? 'eye-off' : 'eye'" svgClass="w-5 h-5" />
                </button>
              </div>
              <app-password-criteria-indicator [password]="resetForm.controls.newPassword.value" />
              @if (
                (resetForm.controls.newPassword.touched || resetForm.controls.newPassword.dirty) &&
                resetForm.controls.newPassword.invalid
              ) {
                <p class="text-xs text-cranberry-700 font-medium mt-1">
                  A nova senha deve atender a todos os requisitos acima.
                </p>
              }
            </div>

            <button
              type="submit"
              data-testid="reset-pin-submit-btn"
              [disabled]="isSubmitting()"
              class="w-full min-h-12 rounded-xl bg-pine-800 hover:bg-pine-900 disabled:opacity-60 text-white font-bold text-base shadow-sm transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              @if (isSubmitting()) {
                <app-festive-icon name="spinner" svgClass="w-5 h-5" />
                <span>Salvando nova senha...</span>
              } @else {
                <span>Salvar Nova Senha</span>
              }
            </button>
          </form>
        }
      </section>
    </div>
  `
})
export class ResetPinPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly apiService = inject(SecretSantaApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly showPassword = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly resetCompleted = signal<boolean>(false);
  readonly updatedUsername = signal<string | null>(null);

  private token = '';

  readonly resetForm = this.fb.group({
    newPassword: ['', [Validators.required, strongPasswordValidator()]]
  });

  ngOnInit(): void {
    this.token = (this.route.snapshot.paramMap.get('token') ?? '').trim();
  }

  ngOnDestroy(): void {
    this.resetForm.reset();
  }

  submitResetPassword(): void {
    this.errorMessage.set(null);
    const newPassword = this.resetForm.controls.newPassword.value;

    if (!this.token) {
      this.errorMessage.set(
        'Link de redefinição inválido ou expirado. Peça um novo link ao organizador do seu grupo no WhatsApp.'
      );
      return;
    }

    if (!evaluatePasswordCriteria(newPassword).isValid) {
      this.errorMessage.set('A nova senha deve atender a todos os requisitos mínimos de segurança.');
      return;
    }

    this.isSubmitting.set(true);
    this.apiService
      .resetPassword({
        token: this.token,
        newPassword
      })
      .subscribe({
        next: (result) => {
          this.isSubmitting.set(false);
          this.showPassword.set(false);
          this.resetForm.reset();
          this.updatedUsername.set(result.username);
          this.resetCompleted.set(true);
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          this.resetForm.reset();
          if (err.status === 400) {
            this.errorMessage.set(
              'Este link de redefinição é inválido, já foi utilizado ou expirou. Peça um novo link ao organizador do grupo no WhatsApp.'
            );
          } else {
            this.errorMessage.set('Não foi possível redefinir a senha. Tente novamente.');
          }
        }
      });
  }
}
