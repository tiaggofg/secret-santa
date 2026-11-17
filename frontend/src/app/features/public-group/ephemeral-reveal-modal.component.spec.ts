import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EphemeralRevealModalComponent } from './ephemeral-reveal-modal.component';

describe('EphemeralRevealModalComponent', () => {
  let fixture: ComponentFixture<EphemeralRevealModalComponent>;
  let component: EphemeralRevealModalComponent;

  beforeEach(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.cookie = '';

    await TestBed.configureTestingModule({
      imports: [EphemeralRevealModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(EphemeralRevealModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('displays drawnParticipantName in a high-contrast card with button "Fechar" and "Sigilo de Natal" notice (C33)', () => {
    component.drawnParticipantName = 'Lucas Godoy';
    component.username = 'maria.silva';
    fixture.detectChanges();

    const nameBox = fixture.nativeElement.querySelector('[data-testid="drawn-participant-name"]');
    const closeBtn = fixture.nativeElement.querySelector('[data-testid="close-and-pass-phone-btn"]');

    expect(nameBox).not.toBeNull();
    expect(nameBox.textContent).toContain('Lucas Godoy');
    expect(fixture.nativeElement.textContent).toContain('Sigilo de Natal');
    expect(fixture.nativeElement.textContent).toContain('consultá-lo novamente a qualquer momento usando sua senha');
    expect(closeBtn).not.toBeNull();
    expect(closeBtn.textContent.trim()).toBe('Fechar');
  });

  it('wipes drawnName Signal to null and removes modal from DOM immediately on clicking "Fechar" (C34)', () => {
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);
    component.open('Ana Clara', 'joao.silva');
    fixture.detectChanges();

    expect(component.drawnName()).toBe('Ana Clara');
    expect(fixture.nativeElement.querySelector('[data-testid="ephemeral-reveal-card"]')).not.toBeNull();

    const closeBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="close-and-pass-phone-btn"]'
    );
    closeBtn.click();
    fixture.detectChanges();

    expect(component.drawnName()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="ephemeral-reveal-card"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Ana Clara');
    expect(closedSpy).toHaveBeenCalledTimes(1);
  });

  it('wipes drawnName Signal to null and destroys DOM when document visibilityState changes to hidden (C34)', () => {
    component.open('Pedro Henrique', 'maria.silva');
    fixture.detectChanges();

    expect(component.drawnName()).toBe('Pedro Henrique');

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true
    });
    document.dispatchEvent(new Event('visibilitychange'));
    fixture.detectChanges();

    expect(component.drawnName()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="ephemeral-reveal-card"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Pedro Henrique');

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true
    });
  });

  it('wipes drawnName Signal to null on ngOnDestroy lifecycle hook (C34)', () => {
    component.open('Beatriz Silva', 'tiago.godoy');
    fixture.detectChanges();
    expect(component.drawnName()).toBe('Beatriz Silva');

    fixture.destroy();

    expect(component.drawnName()).toBeNull();
    expect(component.participantUsername()).toBeNull();
  });

  it('never writes drawnParticipantName or PIN to localStorage, sessionStorage, cookies or URL (C35)', () => {
    const localSetItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    component.open('Segredo Absoluto', 'tiago.godoy');
    fixture.detectChanges();
    component.wipeAndClose();
    fixture.detectChanges();

    expect(localSetItemSpy).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).not.toContain('Segredo Absoluto');
    expect(window.location.href).not.toContain('Segredo');

    localSetItemSpy.mockRestore();
  });
});
