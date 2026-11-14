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
    resetPin: vi.fn()
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

  it('validates that the new PIN is 4 to 6 numeric digits before calling the API', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#new-pin');
    expect(input.getAttribute('inputmode')).toBe('numeric');

    component.resetForm.setValue({ newPin: '12a' });
    component.submitResetPin();
    fixture.detectChanges();

    expect(apiMock.resetPin).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="reset-pin-error"]')?.textContent).toContain(
      '4 a 6 dígitos numéricos'
    );
  });

  it('submits { token, newPin } to POST /api/v1/auth/reset-pin and shows confirmation with link to proceed', () => {
    apiMock.resetPin.mockReturnValue(
      of({
        userId: 'u-1',
        username: 'maria.silva',
        message: 'PIN updated successfully'
      })
    );

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#new-pin');
    input.value = '567890';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form: HTMLFormElement = fixture.nativeElement.querySelector('[data-testid="reset-pin-form"]');
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(apiMock.resetPin).toHaveBeenCalledWith({
      token: 'one-time-token-abc',
      newPin: '567890'
    });
    expect(component.resetCompleted()).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="reset-pin-success"]')?.textContent).toContain(
      '@maria.silva'
    );
    expect(fixture.nativeElement.querySelector('[data-testid="proceed-home-link"]')).not.toBeNull();
  });

  it('displays clear error message instructing to ask organizer for a new link when token is expired or already used (HTTP 400)', () => {
    apiMock.resetPin.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, statusText: 'Bad Request' }))
    );

    component.resetForm.setValue({ newPin: '4321' });
    component.submitResetPin();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[data-testid="reset-pin-error"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('inválido, já foi utilizado ou expirou');
    expect(alert.textContent).toContain('organizador');
  });

  it('clears the PIN field from memory on component destroy', () => {
    component.resetForm.setValue({ newPin: '9876' });
    fixture.destroy();
    expect(component.resetForm.controls.newPin.value).toBe('');
  });
});
