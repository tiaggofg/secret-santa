import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';

@Component({
  selector: 'app-reset-pin-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div>
        <a
          routerLink="/"
          class="text-sm font-semibold text-emerald-800 hover:underline inline-flex items-center gap-1"
        >
          ← Ir para Tela Inicial
        </a>
      </div>

      <section class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div class="space-y-1">
          <span class="text-xs font-bold uppercase tracking-wider text-emerald-800">
            Recuperação de Acesso
          </span>
          <h1 class="text-xl font-bold text-slate-900">Definir Novo PIN</h1>
          <p class="text-xs text-slate-600">
            Crie um novo PIN numérico de 4 a 6 dígitos para sua conta. Este link é de uso único.
          </p>
        </div>

        @if (errorMessage()) {
          <div
            role="alert"
            data-testid="reset-pin-error"
            class="rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm text-red-800 font-medium"
          >
            {{ errorMessage() }}
          </div>
        }

        @if (resetCompleted()) {
          <div
            role="status"
            data-testid="reset-pin-success"
            class="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-3"
          >
            <p class="text-base font-bold text-emerald-950">
              PIN atualizado com sucesso para &#64;{{ updatedUsername() }}!
            </p>
            <p class="text-xs text-emerald-800">
              Agora você já pode entrar nos seus grupos ou revelar seu Amigo Secreto usando seu novo PIN.
            </p>
            <a
              routerLink="/"
              data-testid="proceed-home-link"
              class="w-full min-h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm flex items-center justify-center px-4 py-3 shadow-sm"
            >
              Ir para Meus Grupos / Consultar Amigo Secreto
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
              <label for="new-pin" class="block text-sm font-semibold text-slate-800 mb-1">
                Novo PIN Numérico (4 a 6 dígitos)
              </label>
              <input
                id="new-pin"
                type="password"
                inputmode="numeric"
                maxlength="6"
                formControlName="newPin"
                placeholder="Ex: 5678"
                class="w-full min-h-12 rounded-xl border border-slate-300 px-3.5 py-2.5 text-lg tracking-widest focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              data-testid="reset-pin-submit-btn"
              [disabled]="isSubmitting()"
              class="w-full min-h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-base shadow-sm transition"
            >
              Salvar Novo PIN
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
        'Link de redefinição inválido ou expirado. Solicite um novo link ao organizador do seu grupo.'
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
          this.resetForm.reset();
          this.updatedUsername.set(result.username);
          this.resetCompleted.set(true);
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          this.resetForm.reset();
          if (err.status === 400) {
            this.errorMessage.set(
              'Este link de redefinição é inválido, já foi utilizado ou expirou. Solicite um novo link ao organizador do grupo.'
            );
          } else {
            this.errorMessage.set('Não foi possível redefinir o PIN. Tente novamente.');
          }
        }
      });
  }
}
