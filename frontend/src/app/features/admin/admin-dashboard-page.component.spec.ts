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

  const sampleOpenGroup: AdminGroupView = {
    id: 'g-1',
    slug: 'natal-familia-a1b2',
    publicSlug: 'natal-familia-a1b2',
    eventName: 'Natal Família Silva',
    organizerUserId: 'org-1',
    status: 'OPEN',
    geographicRestrictionRelaxed: false,
    sharePath: '/g/natal-familia-a1b2',
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
      url: 'http://localhost:4200/g/natal-familia-a1b2'
    });

    await TestBed.configureTestingModule({
      imports: [AdminDashboardPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ slug: 'natal-familia-a1b2' })
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

  it('renders group status, participants with @username, GPS status and human reveal status without exposing drawn pairs or technical enums', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Natal Família Silva');
    expect(text).toContain('@tiago.silva');
    expect(text).toContain('@maria.silva');
    expect(text).toContain('@lucas.silva');
    expect(text).toContain('GPS Ativo (50m)');
    expect(text).toContain('Sem GPS');
    expect(text).toContain('Inscrições Abertas');
    expect(text).toContain('Aguardando sorteio');
    expect(text).not.toContain('WAITING_DRAW');
    expect(text).not.toContain('PENDING_REVEAL');
    expect(text).not.toContain('drawnParticipantId');
    expect(text).not.toContain('pinHash');

    const statusBadge = fixture.nativeElement.querySelector('[data-testid="group-status-badge"]');
    expect(statusBadge?.getAttribute('data-group-status')).toBe('OPEN');
    const revealBadge = fixture.nativeElement.querySelector('[data-testid="participant-reveal-badge"]');
    expect(revealBadge?.getAttribute('data-reveal-status')).toBe('WAITING_DRAW');
  });

  it('shares the group WhatsApp link (/g/{slug}) via ShareLinkService', async () => {
    const shareBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="share-group-link-btn"]'
    );
    shareBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(shareMock.shareLink).toHaveBeenCalledWith(
      expect.objectContaining({
        pathOrUrl: '/g/natal-familia-a1b2'
      })
    );
    expect(fixture.nativeElement.querySelector('[data-testid="share-feedback"]')?.textContent).toContain(
      '/g/natal-familia-a1b2'
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

    expect(apiMock.generatePasswordResetToken).toHaveBeenCalledWith('natal-familia-a1b2', 'p-2');
    expect(shareMock.shareLink).toHaveBeenCalledWith(
      expect.objectContaining({
        pathOrUrl: '/reset/tok-reset-xyz'
      })
    );
    const resetCard = fixture.nativeElement.querySelector('[data-testid="generated-reset-link-card"]');
    expect(resetCard?.textContent).toContain('/reset/tok-reset-xyz');
  });

  it('removes a participant while group is OPEN and refreshes participant list', () => {
    apiMock.removeParticipant.mockReturnValue(of(void 0));

    const removeBtns: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll(
      '[data-testid="remove-participant-btn"]'
    );
    removeBtns[0].click();
    fixture.detectChanges();

    expect(apiMock.removeParticipant).toHaveBeenCalledWith('natal-familia-a1b2', 'p-1');
    expect(apiMock.getAdminGroup).toHaveBeenCalledTimes(2);
  });

  it('executes the draw after inline confirmation when >= 3 participants are registered and updates status to DRAWN', () => {
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
    expect(drawBtn.disabled).toBe(false);
    drawBtn.click();
    fixture.detectChanges();

    expect(apiMock.executeDraw).not.toHaveBeenCalled();

    const confirmBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="confirm-draw-btn"]'
    );
    expect(confirmBtn).not.toBeNull();
    confirmBtn.click();
    fixture.detectChanges();

    expect(apiMock.executeDraw).toHaveBeenCalledWith('natal-familia-a1b2');
    expect(component.group()?.status).toBe('DRAWN');
    expect(fixture.nativeElement.querySelector('[data-testid="geo-relaxed-badge"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="remove-participant-btn"]').length).toBe(0);
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
