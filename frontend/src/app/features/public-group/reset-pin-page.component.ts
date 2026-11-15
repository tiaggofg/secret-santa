import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';
import { FestiveIconComponent } from '../../shared/components/festive-icon.component';

@Component({
  selector: 'app-reset-pin-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, FestiveIconComponent],
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
            <h1 class="font-display text-2xl font-bold text-ink-900 mt-0.5">Criar Novo PIN</h1>
            <p class="text-xs text-ink-600 leading-relaxed mt-1">
              Crie um novo PIN numérico de 4 a 6 dígitos para sua conta. Este link é de uso único e garante sua privacidade no sorteio.
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
              <span>PIN atualizado com sucesso para &#64;{{ updatedUsername() }}!</span>
            </p>
            <p class="text-xs text-pine-800 leading-relaxed">
              Agora você já pode entrar nos seus grupos ou abrir seu Amigo Secreto usando seu novo PIN.
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
            (ngSubmit)="submitResetPin()"
            data-testid="reset-pin-form"
            class="space-y-4"
          >
            <div>
              <label for="new-pin" class="block text-sm font-semibold text-ink-900 mb-1.5">
                Novo PIN Numérico (4 a 6 dígitos)
              </label>
              <div class="relative flex items-center">
                <input
                  id="new-pin"
                  [type]="showPin() ? 'text' : 'password'"
                  inputmode="numeric"
                  maxlength="6"
                  formControlName="newPin"
                  placeholder="Ex: 5678"
                  class="w-full min-h-12 rounded-xl border border-stone-300 bg-white pl-3.5 pr-12 py-2.5 text-lg tracking-widest tabular-nums text-ink-900 focus:border-pine-800 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                />
                <button
                  type="button"
                  (click)="showPin.set(!showPin())"
                  aria-label="Mostrar ou ocultar PIN"
                  class="absolute right-1 min-w-11 min-h-11 rounded-lg flex items-center justify-center text-ink-600 hover:text-pine-900 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <app-festive-icon [name]="showPin() ? 'eye-off' : 'eye'" svgClass="w-5 h-5" />
                </button>
              </div>
              @if (
                (resetForm.controls.newPin.touched || resetForm.controls.newPin.dirty) &&
                resetForm.controls.newPin.invalid
              ) {
                <p class="text-xs text-cranberry-700 font-medium mt-1">
                  Digite apenas números de 4 a 6 dígitos (ex: 5678).
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
                <span>Salvando novo PIN...</span>
              } @else {
                <span>Salvar Novo PIN</span>
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

  readonly showPin = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly resetCompleted = signal<boolean>(false);
  readonly updatedUsername = signal<string | null>(null);

  private token = '';

  readonly resetForm = this.fb.group({
    newPin: ['', [Validators.required, Validators.pattern(/^\d{4,6}$/)]]
  });

  ngOnInit(): void {
    this.token = (this.route.snapshot.paramMap.get('token') ?? '').trim();
  }

  ngOnDestroy(): void {
    this.resetForm.reset();
  }

  submitResetPin(): void {
    this.errorMessage.set(null);
    const newPin = this.resetForm.controls.newPin.value.trim();

    if (!this.token) {
      this.errorMessage.set(
        'Link de redefinição inválido ou expirado. Peça um novo link ao organizador do seu grupo no WhatsApp.'
      );
      return;
    }

    if (!/^\d{4,6}$/.test(newPin)) {
      this.errorMessage.set('O novo PIN deve conter exclusivamente de 4 a 6 dígitos numéricos.');
      return;
    }

    this.isSubmitting.set(true);
    this.apiService
      .resetPin({
        token: this.token,
        newPin
      })
      .subscribe({
        next: (result) => {
          this.isSubmitting.set(false);
          this.showPin.set(false);
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
            this.errorMessage.set('Não foi possível redefinir o PIN. Tente novamente.');
          }
        }
      });
  }
}
