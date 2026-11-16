import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { evaluatePasswordCriteria } from '../password-policy';

@Component({
  selector: 'app-password-criteria-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      data-testid="password-criteria-indicator"
      class="mt-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-xs"
    >
      <p class="font-semibold text-slate-700 mb-1.5">Requisitos da senha:</p>
      <ul class="space-y-1">
        <li [class]="criteria().lengthValid ? 'text-emerald-700 font-semibold flex items-center gap-1.5' : 'text-slate-500 flex items-center gap-1.5'">
          <span aria-hidden="true">{{ criteria().lengthValid ? '✓' : '○' }}</span>
          <span>6 a 64 caracteres</span>
        </li>
        <li [class]="criteria().hasUpper ? 'text-emerald-700 font-semibold flex items-center gap-1.5' : 'text-slate-500 flex items-center gap-1.5'">
          <span aria-hidden="true">{{ criteria().hasUpper ? '✓' : '○' }}</span>
          <span>Pelo menos 1 letra maiúscula (A-Z)</span>
        </li>
        <li [class]="criteria().hasLower ? 'text-emerald-700 font-semibold flex items-center gap-1.5' : 'text-slate-500 flex items-center gap-1.5'">
          <span aria-hidden="true">{{ criteria().hasLower ? '✓' : '○' }}</span>
          <span>Pelo menos 1 letra minúscula (a-z)</span>
        </li>
        <li [class]="criteria().hasDigit ? 'text-emerald-700 font-semibold flex items-center gap-1.5' : 'text-slate-500 flex items-center gap-1.5'">
          <span aria-hidden="true">{{ criteria().hasDigit ? '✓' : '○' }}</span>
          <span>Pelo menos 1 número (0-9)</span>
        </li>
        <li [class]="criteria().hasSpecial ? 'text-emerald-700 font-semibold flex items-center gap-1.5' : 'text-slate-500 flex items-center gap-1.5'">
          <span aria-hidden="true">{{ criteria().hasSpecial ? '✓' : '○' }}</span>
          <span>Pelo menos 1 caractere especial (ex.: ! &#64; # $ % &amp; *)</span>
        </li>
        @if (criteria().hasWhitespace) {
          <li class="text-rose-700 font-semibold flex items-center gap-1.5" role="alert">
            <span aria-hidden="true">✕</span>
            <span>Não pode conter espaços em branco</span>
          </li>
        }
      </ul>
    </div>
  `
})
export class PasswordCriteriaIndicatorComponent {
  readonly password = input<string | null | undefined>('');
  readonly criteria = computed(() => evaluatePasswordCriteria(this.password()));
}
