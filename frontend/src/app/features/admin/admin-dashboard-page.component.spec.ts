import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminDashboardPageComponent } from './admin-dashboard-page.component';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';
import { ShareLinkService } from '../../core/share/share-link.service';
import { AdminGroupView } from '../../core/api/secret-santa-api.models';
import { ToastService } from '../../shared/toast/toast.service';

describe('AdminDashboardPageComponent', () => {
  let fixture: ComponentFixture<AdminDashboardPageComponent>;
  let component: AdminDashboardPageComponent;

  const groupId = '11111111-1111-1111-1111-111111111111';
  const signedSharePath = `/g/${groupId}?sig=sig_abc123456`;

  const sampleOpenGroup: AdminGroupView = {
    id: groupId,
    eventName: 'Natal Família Silva',
    organizerUserId: 'org-1',
    status: 'OPEN',
    geographicRestrictionRelaxed: false,
    sharePath: signedSharePath,
    createdAt: '2026-11-13T18:00:00Z',
    drawnAt: null,
    participants: [
      {
        id: 'p-1',
        userId: 'u-1',
        name: 'Tiago Silva',
        username: 'tiago.silva',
        hasGeoLocation: true,
        revealStatus: 'WAITING_DRAW',
        createdAt: '2026-11-13T18:01:00Z'
      },
      {
        id: 'p-2',
        userId: 'u-2',
        name: 'Maria Silva',
        username: 'maria.silva',
        hasGeoLocation: true,
        revealStatus: 'WAITING_DRAW',
        createdAt: '2026-11-13T18:02:00Z'
      },
      {
        id: 'p-3',
        userId: 'u-3',
        name: 'Lucas Silva',
        username: 'lucas.silva',
        hasGeoLocation: false,
        revealStatus: 'WAITING_DRAW',
        createdAt: '2026-11-13T18:03:00Z'
      }
    ]
  };

  const apiMock = {
    getAdminGroup: vi.fn(),
    rotateInviteLink: vi.fn(),
    removeParticipant: vi.fn(),
    executeDraw: vi.fn(),
    generatePasswordResetToken: vi.fn()
  };

  const shareMock = {
    shareLink: vi.fn(),
    copyUrl: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    apiMock.getAdminGroup.mockReturnValue(of(sampleOpenGroup));
    shareMock.shareLink.mockResolvedValue({
      method: 'clipboard',
      url: `http://localhost:4200${signedSharePath}`
    });
    shareMock.copyUrl.mockResolvedValue({
      method: 'clipboard',
      url: `http://localhost:4200${signedSharePath}`
    });

    await TestBed.configureTestingModule({
      imports: [AdminDashboardPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ groupId })
            }
          }
        },
        { provide: SecretSantaApiService, useValue: apiMock },
        { provide: ShareLinkService, useValue: shareMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders group status, participants, GPS status and human reveal status without exposing technical invite URL or secret fields', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Natal Família Silva');
    expect(text).not.toContain(signedSharePath);
    expect(fixture.nativeElement.querySelector('[data-testid="signed-share-path"]')).toBeNull();
    expect(text).toContain('@tiago.silva');
    expect(text).toContain('@maria.silva');
    expect(text).toContain('@lucas.silva');
    expect(text).toContain('GPS 50m');
    expect(text).toContain('Sem GPS');
    expect(text).toContain('Inscrições Abertas');
    expect(text).toContain('Aguardando sorteio');
    expect(text).toContain('Convidar pelo WhatsApp');
    expect(text).toContain('Copiar Link');
    expect(text).toContain('Gerar Novo Link de Convite');
    expect(text).not.toContain('Alterar PIN do Grupo');
    expect(text).not.toContain('WAITING_DRAW');
    expect(text).not.toContain('PENDING_REVEAL');
    expect(text).not.toContain('drawnParticipantId');
    expect(text).not.toContain('pinHash');
    expect(text.toLowerCase()).not.toContain('username');
  });

  it('shows friendly missing-participants hint and disables draw button when fewer than 3 participants are enrolled', () => {
    apiMock.getAdminGroup.mockReturnValue(
      of({
        ...sampleOpenGroup,
        participants: sampleOpenGroup.participants.slice(0, 2)
      })
    );
    component.loadAdminGroup();
    fixture.detectChanges();

    const hint = fixture.nativeElement.querySelector('[data-testid="min-participants-hint"]');
    const drawBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="execute-draw-btn"]');
    expect(hint?.textContent).toContain('Falta 1 participante para liberar o sorteio.');
    expect(drawBtn.disabled).toBe(true);
  });

  it('shares the signed group WhatsApp link and copies URL via Copiar Link with concise toasts (no raw URL exposed)', async () => {
    const shareBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="share-group-link-btn"]'
    );
    expect(shareBtn.textContent).toContain('Convidar pelo WhatsApp');
    shareBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(shareMock.shareLink).toHaveBeenCalledWith({
      title: 'Amigo Secreto: Natal Família Silva',
      text: 'Participe do grupo de amigo secreto "Natal Família Silva" clicando no link abaixo:',
      pathOrUrl: signedSharePath,
      openWhatsAppFallback: true
    });
    const toastService = TestBed.inject(ToastService);
    expect(toastService.toasts().some((t) => t.message.includes('Convite copiado!'))).toBe(true);
    expect(toastService.toasts().some((t) => t.message.includes(signedSharePath))).toBe(false);
    toastService.clear();

    const copyBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="copy-group-link-btn"]'
    );
    expect(copyBtn.textContent).toContain('Copiar Link');
    copyBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(shareMock.copyUrl).toHaveBeenCalledWith(signedSharePath);
    expect(copyBtn.textContent).toContain('Copiado!');
    expect(toastService.toasts().some((t) => t.message === 'Link de convite copiado!')).toBe(true);
    expect(toastService.toasts().some((t) => t.message.includes(signedSharePath))).toBe(false);
    toastService.clear();
  });

  it('requires inline confirmation before rotating the group invite link', () => {
    const rotatedPath = `/g/${groupId}?sig=sig_new_rotated_999`;
    apiMock.rotateInviteLink.mockReturnValue(
      of({
        ...sampleOpenGroup,
        sharePath: rotatedPath
      })
    );

    const rotateBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="rotate-invite-link-btn"]'
    );
    rotateBtn.click();
    fixture.detectChanges();

    expect(apiMock.rotateInviteLink).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="rotate-invite-confirm"]')).not.toBeNull();

    const cancelBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="cancel-rotate-invite-btn"]'
    );
    cancelBtn.click();
    fixture.detectChanges();
    expect(apiMock.rotateInviteLink).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="rotate-invite-confirm"]')).toBeNull();

    fixture.nativeElement.querySelector('[data-testid="rotate-invite-link-btn"]').click();
    fixture.detectChanges();
    const confirmBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="confirm-rotate-invite-btn"]'
    );
    confirmBtn.click();
    fixture.detectChanges();

    expect(apiMock.rotateInviteLink).toHaveBeenCalledWith(groupId);
    expect(component.group()?.sharePath).toBe(rotatedPath);
    const toastService = TestBed.inject(ToastService);
    expect(
      toastService.toasts().some((t) => t.message.includes('Novo link de convite gerado! O link anterior foi invalidado.'))
    ).toBe(true);
    toastService.clear();
  });

  it('generates reset card without exposing /reset/{token}, supports copy/share and dismisses cleanly', async () => {
    const resetPath = '/reset/tok-reset-xyz';
    apiMock.generatePasswordResetToken.mockReturnValue(
      of({
        participantId: 'p-2',
        userId: 'u-2',
        username: 'maria.silva',
        resetToken: 'tok-reset-xyz',
        resetPath,
        expiresAt: '2026-11-14T18:00:00Z'
      })
    );
    shareMock.shareLink.mockResolvedValue({
      method: 'clipboard',
      url: `http://localhost:4200${resetPath}`
    });
    shareMock.copyUrl.mockResolvedValue({
      method: 'clipboard',
      url: `http://localhost:4200${resetPath}`
    });

    const resetBtns: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll(
      '[data-testid="generate-reset-token-btn"]'
    );
    resetBtns[1].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(apiMock.generatePasswordResetToken).toHaveBeenCalledWith(groupId, 'p-2');
    expect(shareMock.shareLink).toHaveBeenCalledWith(
      expect.objectContaining({
        pathOrUrl: resetPath
      })
    );

    const card: HTMLElement | null = fixture.nativeElement.querySelector(
      '[data-testid="generated-reset-link-card"]'
    );
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain('Link de Redefinição para @maria.silva');
    expect(card?.textContent).not.toContain(resetPath);

    const toastService = TestBed.inject(ToastService);
    expect(toastService.toasts().some((t) => t.message.includes(resetPath))).toBe(false);
    toastService.clear();

    const copyResetBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="copy-reset-link-btn"]'
    );
    copyResetBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(shareMock.copyUrl).toHaveBeenCalledWith(resetPath);
    expect(copyResetBtn.textContent).toContain('Copiado!');
    expect(
      toastService.toasts().some((t) => t.message === 'Link de redefinição copiado para @maria.silva!')
    ).toBe(true);
    toastService.clear();

    const dismissBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="dismiss-reset-link-btn"]'
    );
    dismissBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="generated-reset-link-card"]')).toBeNull();
  });

  it('requires inline confirmation before removing a participant while group is OPEN', () => {
    apiMock.removeParticipant.mockReturnValue(of(void 0));

    const removeBtns: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll(
      '[data-testid="remove-participant-btn"]'
    );
    removeBtns[0].click();
    fixture.detectChanges();

    expect(apiMock.removeParticipant).not.toHaveBeenCalled();
    const confirmBox = fixture.nativeElement.querySelector('[data-testid="remove-participant-confirm"]');
    expect(confirmBox?.textContent).toContain('Remover Tiago Silva do grupo?');

    const cancelBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="cancel-remove-participant-btn"]'
    );
    cancelBtn.click();
    fixture.detectChanges();
    expect(apiMock.removeParticipant).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="remove-participant-confirm"]')).toBeNull();

    fixture.nativeElement.querySelectorAll('[data-testid="remove-participant-btn"]')[0].click();
    fixture.detectChanges();

    const confirmBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="confirm-remove-participant-btn"]'
    );
    confirmBtn.click();
    fixture.detectChanges();

    expect(apiMock.removeParticipant).toHaveBeenCalledWith(groupId, 'p-1');
    expect(apiMock.getAdminGroup).toHaveBeenCalledTimes(2);
  });

  it('executes the draw after inline confirmation, hides invite card and shows reveal progress in DRAWN state', () => {
    const drawnGroup: AdminGroupView = {
      ...sampleOpenGroup,
      status: 'DRAWN',
      geographicRestrictionRelaxed: true,
      drawnAt: '2026-11-13T19:00:00Z',
      participants: sampleOpenGroup.participants.map((p, index) => ({
        ...p,
        revealStatus: index === 0 ? 'REVEALED' : 'PENDING_REVEAL'
      }))
    };
    apiMock.executeDraw.mockReturnValue(of(drawnGroup));

    const drawBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="execute-draw-btn"]'
    );
    drawBtn.click();
    fixture.detectChanges();

    const confirmBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="confirm-draw-btn"]'
    );
    confirmBtn.click();
    fixture.detectChanges();

    expect(apiMock.executeDraw).toHaveBeenCalledWith(groupId);
    expect(component.group()?.status).toBe('DRAWN');
    expect(fixture.nativeElement.querySelector('[data-testid="invite-card"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="share-group-link-btn"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="remove-participant-btn"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="reveal-progress-label"]')?.textContent).toContain(
      '1 de 3 já descobriram'
    );
    expect(fixture.nativeElement.querySelector('[data-testid="reveal-progress-bar"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="geo-relaxed-badge"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="open-reveal-page-link"]')).not.toBeNull();
  });

  it('displays access denied error when non-organizer receives HTTP 403', () => {
    apiMock.getAdminGroup.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' }))
    );

    component.loadAdminGroup();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[data-testid="admin-error"]');
    expect(alert?.textContent).toContain('apenas o organizador');
  });
});
