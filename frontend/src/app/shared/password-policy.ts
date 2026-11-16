import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 64;

export interface PasswordCriteriaStatus {
  lengthValid: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
  noWhitespace: boolean;
  hasWhitespace: boolean;
  isValid: boolean;
}

export function evaluatePasswordCriteria(rawValue: string | null | undefined): PasswordCriteriaStatus {
  const value = rawValue ?? '';
  const lengthValid = value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /[0-9]/.test(value);
  const hasSpecial = /[^A-Za-z0-9\s]/.test(value);
  const hasWhitespace = /\s/.test(value);
  const noWhitespace = !hasWhitespace;

  return {
    lengthValid,
    hasUpper,
    hasLower,
    hasDigit,
    hasSpecial,
    noWhitespace,
    hasWhitespace,
    isValid: lengthValid && hasUpper && hasLower && hasDigit && hasSpecial && noWhitespace
  };
}

export function strongPasswordValidator(): ValidatorFn {
  return (control: AbstractControl<string | null>): ValidationErrors | null => {
    const value = control.value ?? '';
    if (!value) {
      return null;
    }
    const status = evaluatePasswordCriteria(value);
    return status.isValid ? null : { strongPassword: status };
  };
}
