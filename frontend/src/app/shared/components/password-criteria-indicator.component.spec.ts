import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { PasswordCriteriaIndicatorComponent } from './password-criteria-indicator.component';
import { evaluatePasswordCriteria, strongPasswordValidator } from '../password-policy';

describe('PasswordCriteriaIndicatorComponent & password-policy', () => {
  let fixture: ComponentFixture<PasswordCriteriaIndicatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordCriteriaIndicatorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordCriteriaIndicatorComponent);
  });

  it('should evaluate strong password criteria accurately', () => {
    expect(evaluatePasswordCriteria('Natal@2026').isValid).toBe(true);
    expect(evaluatePasswordCriteria('Ab1!cd').isValid).toBe(true);

    expect(evaluatePasswordCriteria('Ab1!c').lengthValid).toBe(false);
    expect(evaluatePasswordCriteria('natal@2026').hasUpper).toBe(false);
    expect(evaluatePasswordCriteria('NATAL@2026').hasLower).toBe(false);
    expect(evaluatePasswordCriteria('Natal@abcd').hasDigit).toBe(false);
    expect(evaluatePasswordCriteria('Natal2026').hasSpecial).toBe(false);
    expect(evaluatePasswordCriteria('Natal @2026').hasWhitespace).toBe(true);
    expect(evaluatePasswordCriteria('Natal @2026').isValid).toBe(false);
  });

  it('should validate Reactive Form control using strongPasswordValidator', () => {
    const control = new FormControl('weak', [strongPasswordValidator()]);
    expect(control.errors).toBeTruthy();

    control.setValue('Natal@2026');
    expect(control.errors).toBeNull();
  });

  it('should render checklist and whitespace warning dynamically', () => {
    fixture.componentRef.setInput('password', 'Natal @2026');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const indicator = el.querySelector('[data-testid="password-criteria-indicator"]');
    expect(indicator?.textContent).toContain('6 a 64 caracteres');
    expect(indicator?.textContent).toContain('Não pode conter espaços em branco');

    fixture.componentRef.setInput('password', 'Natal@2026');
    fixture.detectChanges();
    expect(indicator?.textContent).not.toContain('Não pode conter espaços em branco');
  });
});
