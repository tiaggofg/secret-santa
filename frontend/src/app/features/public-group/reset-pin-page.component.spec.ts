import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResetPinPageComponent } from './reset-pin-page.component';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';

describe('ResetPinPageComponent', () => {
  let fixture: ComponentFixture<ResetPinPageComponent>;
  let component: ResetPinPageComponent;

  const apiMock = {
    resetPassword: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ResetPinPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ token: 'one-time-token-abc' })
            }
          }
        },
        { provide: SecretSantaApiService, useValue: apiMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPinPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('validates strong password criteria before calling the API and renders criteria indicator', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#new-password');
    expect(input).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="password-criteria-indicator"]')).not.toBeNull();

    component.resetForm.setValue({ newPassword: 'weak' });
    component.submitResetPassword();
    fixture.detectChanges();

    expect(apiMock.resetPassword).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="reset-pin-error"]')?.textContent).toContain(
      'requisitos mínimos'
    );
  });

  it('submits { token, newPassword } to POST /api/v1/auth/reset-password and shows confirmation with link to proceed', () => {
    apiMock.resetPassword.mockReturnValue(
      of({
        userId: 'u-1',
        username: 'maria.silva',
        message: 'Password updated successfully'
      })
    );

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#new-password');
    input.value = 'Nova@2026';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form: HTMLFormElement = fixture.nativeElement.querySelector('[data-testid="reset-pin-form"]');
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(apiMock.resetPassword).toHaveBeenCalledWith({
      token: 'one-time-token-abc',
      newPassword: 'Nova@2026'
    });
    expect(component.resetCompleted()).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="reset-pin-success"]')?.textContent).toContain(
      '@maria.silva'
    );
    expect(fixture.nativeElement.querySelector('[data-testid="proceed-home-link"]')).not.toBeNull();
  });

  it('displays clear error message instructing to ask organizer for a new link when token is expired or already used (HTTP 400)', () => {
    apiMock.resetPassword.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }))
    );

    component.resetForm.setValue({ newPassword: 'Nova@2026' });
    component.submitResetPassword();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[data-testid="reset-pin-error"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('inválido, já foi utilizado ou expirou');
    expect(alert.textContent).toContain('organizador');
  });

  it('clears the password field from memory on component destroy', () => {
    component.resetForm.setValue({ newPassword: 'Nova@2026' });
    fixture.destroy();
    expect(component.resetForm.controls.newPassword.value).toBe('');
  });
});
