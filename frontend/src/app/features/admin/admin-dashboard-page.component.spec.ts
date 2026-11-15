import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminDashboardPageComponent } from './admin-dashboard-page.component';
import { SecretSantaApiService } from '../../core/api/secret-santa-api.service';
import { ShareLinkService } from '../../core/share/share-link.service';
import { AdminGroupView } from '../../core/api/secret-santa-api.models';

describe('AdminDashboardPageComponent', () => {
  let fixture: ComponentFixture<AdminDashboardPageComponent>;
  let component: AdminDashboardPageComponent;

  const groupId = '11111111-1111-1111-1111-111111111111';

  const sampleOpenGroup: AdminGroupView = {
    id: groupId,
    eventName: 'Natal Família Silva',
    organizerUserId: 'org-1',
    status: 'OPEN',
    geographicRestrictionRelaxed: false,
    sharePath: `/g/${groupId}`,
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
    updateGroupPin: vi.fn(),
    removeParticipant: vi.fn(),
    executeDraw: vi.fn(),
    generatePasswordResetToken: vi.fn()
  };

  const shareMock = {
    shareLink: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    apiMock.getAdminGroup.mockReturnValue(of(sampleOpenGroup));
    shareMock.shareLink.mockResolvedValue({
      method: 'clipboard',
      url: `http://localhost:4200/g/${groupId}`
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

  it('renders group status, participants, GPS status and human reveal status without exposing secrets', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Natal Família Silva');
    expect(text).toContain('@tiago.silva');
    expect(text).toContain('@maria.silva');
    expect(text).toContain('@lucas.silva');
    expect(text).toContain('GPS Ativo (50m)');
    expect(text).toContain('Sem GPS');
    expect(text).toContain('Inscrições Abertas');
    expect(text).toContain('Aguardando sorteio');
    expect(text).toContain('Convidar pelo WhatsApp');
    expect(text).not.toContain('WAITING_DRAW');
    expect(text).not.toContain('PENDING_REVEAL');
    expect(text).not.toContain('drawnParticipantId');
    expect(text).not.toContain('pinHash');
    expect(text.toLowerCase()).not.toContain('username');
  });

  it('shares the group WhatsApp link (/g/{uuid}) via ShareLinkService', async () => {
    const shareBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="share-group-link-btn"]'
    );
    expect(shareBtn.textContent).toContain('Convidar pelo WhatsApp');
    shareBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(shareMock.shareLink).toHaveBeenCalledWith(
      expect.objectContaining({
        pathOrUrl: `/g/${groupId}`,
        text: expect.stringContaining('PIN de entrada ao organizador')
      })
    );
    expect(fixture.nativeElement.querySelector('[data-testid="share-feedback"]')?.textContent).toContain(
      `/g/${groupId}`
    );
  });

  it('updates group PIN via PUT /admin/pin and displays feedback', () => {
    apiMock.updateGroupPin.mockReturnValue(of(void 0));

    component.updateGroupPinForm.setValue({ groupPin: '9988' });
    const updateBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="update-group-pin-btn"]'
    );
    updateBtn.closest('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(apiMock.updateGroupPin).toHaveBeenCalledWith(groupId, { groupPin: '9988' });
    expect(fixture.nativeElement.querySelector('[data-testid="update-group-pin-feedback"]')?.textContent).toContain(
      'PIN do grupo atualizado com sucesso!'
    );
  });

  it('generates and shares a one-time PIN reset link (/reset/{token}) for a participant', async () => {
    apiMock.generatePasswordResetToken.mockReturnValue(
      of({
        participantId: 'p-2',
        userId: 'u-2',
        username: 'maria.silva',
        resetToken: 'tok-reset-xyz',
        resetPath: '/reset/tok-reset-xyz',
        expiresAt: '2026-11-14T18:00:00Z'
      })
    );
    shareMock.shareLink.mockResolvedValue({
      method: 'clipboard',
      url: 'http://localhost:4200/reset/tok-reset-xyz'
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
        pathOrUrl: '/reset/tok-reset-xyz'
      })
    );
  });

  it('removes a participant while group is OPEN and refreshes participant list', () => {
    apiMock.removeParticipant.mockReturnValue(of(void 0));

    const removeBtns: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll(
      '[data-testid="remove-participant-btn"]'
    );
    removeBtns[0].click();
    fixture.detectChanges();

    expect(apiMock.removeParticipant).toHaveBeenCalledWith(groupId, 'p-1');
    expect(apiMock.getAdminGroup).toHaveBeenCalledTimes(2);
  });

  it('executes the draw after inline confirmation when >= 3 participants are registered', () => {
    const drawnGroup: AdminGroupView = {
      ...sampleOpenGroup,
      status: 'DRAWN',
      geographicRestrictionRelaxed: true,
      drawnAt: '2026-11-13T19:00:00Z',
      participants: sampleOpenGroup.participants.map((p) => ({
        ...p,
        revealStatus: 'PENDING_REVEAL'
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
