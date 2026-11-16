import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RegisterPageComponent } from './register-page.component';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';
import { AuthSessionStore } from '../../core/auth/auth-session.store';

describe('RegisterPageComponent', () => {
  let fixture: ComponentFixture<RegisterPageComponent>;
  let component: RegisterPageComponent;
  let authStore: AuthSessionStore;
  let router: Router;

  const apiMock = {
    register: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [RegisterPageComponent],
      providers: [
        provideRouter([]),
        AuthSessionStore,
        { provide: SecretSantaApiService, useValue: apiMock }
      ]
    }).compileComponents();

    authStore = TestBed.inject(AuthSessionStore);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture = TestBed.createComponent(RegisterPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('auto-suggests username from name, submits strong password, stores session and navigates to /', () => {
    apiMock.register.mockReturnValue(
      of({
        userId: 'u-1',
        name: 'Maria Clara',
        username: 'maria.clara'
      })
    );

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('#reg-name');
    nameInput.value = 'Maria Clara';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.registerForm.controls.username.value).toBe('maria.clara');

    const passwordInput: HTMLInputElement = fixture.nativeElement.querySelector('#reg-password');
    passwordInput.value = 'Natal@2026';
    passwordInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="password-criteria-indicator"]')).toBeTruthy();

    const submitBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="register-submit"]');
    expect(submitBtn.textContent).toContain('Concluir cadastro');
    expect(fixture.nativeElement.textContent.toLowerCase()).not.toContain('username');

    const form: HTMLFormElement = fixture.nativeElement.querySelector('[data-testid="register-form"]');
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(apiMock.register).toHaveBeenCalledWith({
      name: 'Maria Clara',
      username: 'maria.clara',
      password: 'Natal@2026'
    });
    expect(authStore.isAuthenticated()).toBe(true);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('shows helpful message when registration fails with HTTP 409 duplicate', () => {
    apiMock.register.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, statusText: 'Conflict' }))
    );

    component.registerForm.setValue({
      name: 'Maria Silva',
      username: 'maria.silva',
      password: 'Natal@2026'
    });
    component.submitRegister();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[data-testid="register-error"]');
    expect(alert?.textContent).toContain('já está em uso');
  });
});
