import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';
import { AuthSessionStore } from '../../core/auth/auth-session.store';
import { FestiveIconComponent } from '../../shared/components/festive-icon.component';
import { suggestUsername } from '../../shared/formatters';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, FestiveIconComponent],
  template: `
    <div class="space-y-6">
      <section class="bg-festive-card border border-festive-border rounded-3xl p-5 shadow-sm space-y-4">
        <div class="space-y-1">
          <h1 class="font-display text-2xl font-bold text-ink-900">Criar Conta</h1>
          <p class="text-sm text-ink-600 leading-relaxed">
            Preencha seus dados abaixo para participar ou organizar grupos de Amigo Secreto.
          </p>
        </div>

        @if (errorMessage()) {
          <div
            role="alert"
            data-testid="register-error"
            class="rounded-2xl bg-cranberry-50 border border-cranberry-200 p-3.5 text-sm text-cranberry-800 font-medium break-words"
          >
            {{ errorMessage() }}
          </div>
        }

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
              Nome de usuário
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
              <span>Concluir cadastro</span>
            }
          </button>
        </form>

        <div class="pt-2 border-t border-festive-border text-center">
          <a
            routerLink="/"
            data-testid="go-to-login-link"
            class="inline-flex items-center justify-center min-h-11 text-sm font-semibold text-pine-800 hover:text-pine-950 underline underline-offset-4"
          >
            Já tem uma conta? Entrar
          </a>
        </div>
      </section>
    </div>
  `
})
export class RegisterPageComponent implements OnInit {
  private readonly authStore = inject(AuthSessionStore);
  private readonly apiService = inject(SecretSantaApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly showRegPin = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  private usernameManuallyEdited = false;

  readonly registerForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    username: ['', [Validators.required, Validators.pattern(/^[a-z0-9._-]{3,30}$/)]],
    pin: ['', [Validators.required, Validators.pattern(/^\d{4,6}$/)]]
  });

  ngOnInit(): void {
    if (this.authStore.isAuthenticated()) {
      void this.router.navigateByUrl('/');
    }
  }

  onNameInput(): void {
    if (this.usernameManuallyEdited) {
      return;
    }
    const rawName = this.registerForm.controls.name.value;
    this.registerForm.controls.username.setValue(suggestUsername(rawName), { emitEvent: false });
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
        'Preencha um nome válido (2-60 caracteres), nome de usuário (3-30 caracteres) e PIN numérico de 4 a 6 dígitos.'
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
          this.authStore.setSession(session);
          void this.router.navigateByUrl('/');
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting.set(false);
          if (err.status === 409) {
            this.errorMessage.set(
              'Este nome de usuário já está em uso. Sugerimos adicionar um sobrenome ou número.'
            );
          } else {
            this.errorMessage.set('Não foi possível concluir o cadastro. Verifique os dados informados.');
          }
        }
      });
  }
}
