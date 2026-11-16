import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminGroupView,
  AuthSessionView,
  CreateGroupRequest,
  GroupDiscoveryView,
  JoinGroupRequest,
  LoginUserRequest,
  ParticipantRegistrationView,
  PasswordResetLinkView,
  PinResetResultView,
  PublicGroupView,
  RegisterUserRequest,
  ResetPasswordRequest,
  RevealMatchRequest,
  RevealMatchView
} from './secret-santa-api.models';

@Injectable({
  providedIn: 'root'
})
export class SecretSantaApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/v1`;

  register(request: RegisterUserRequest): Observable<AuthSessionView> {
    return this.http.post<AuthSessionView>(`${this.baseUrl}/auth/register`, request);
  }

  login(request: LoginUserRequest): Observable<AuthSessionView> {
    return this.http.post<AuthSessionView>(`${this.baseUrl}/auth/login`, request);
  }

  me(): Observable<AuthSessionView> {
    return this.http.get<AuthSessionView>(`${this.baseUrl}/auth/me`);
  }

  refresh(): Observable<AuthSessionView> {
    return this.http.post<AuthSessionView>(`${this.baseUrl}/auth/refresh`, {});
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/logout`, {});
  }

  resetPassword(request: ResetPasswordRequest): Observable<PinResetResultView> {
    return this.http.post<PinResetResultView>(`${this.baseUrl}/auth/reset-password`, request);
  }

  listGroups(): Observable<GroupDiscoveryView> {
    return this.http.get<GroupDiscoveryView>(`${this.baseUrl}/groups`);
  }

  createGroup(request: CreateGroupRequest): Observable<AdminGroupView> {
    return this.http.post<AdminGroupView>(`${this.baseUrl}/groups`, request);
  }

  getPublicGroup(groupId: string, sig?: string | null): Observable<PublicGroupView> {
    let params = new HttpParams();
    if (sig && sig.trim().length > 0) {
      params = params.set('sig', sig.trim());
    }
    return this.http.get<PublicGroupView>(`${this.baseUrl}/groups/${encodeURIComponent(groupId)}`, {
      params
    });
  }

  joinGroup(groupId: string, request: JoinGroupRequest): Observable<ParticipantRegistrationView> {
    return this.http.post<ParticipantRegistrationView>(
      `${this.baseUrl}/groups/${encodeURIComponent(groupId)}/participants`,
      request
    );
  }

  revealMatch(groupId: string, request: RevealMatchRequest): Observable<RevealMatchView> {
    return this.http.post<RevealMatchView>(
      `${this.baseUrl}/groups/${encodeURIComponent(groupId)}/participants/reveal`,
      request
    );
  }

  getAdminGroup(groupId: string): Observable<AdminGroupView> {
    return this.http.get<AdminGroupView>(`${this.baseUrl}/groups/${encodeURIComponent(groupId)}/admin`);
  }

  rotateInviteLink(groupId: string): Observable<AdminGroupView> {
    return this.http.post<AdminGroupView>(
      `${this.baseUrl}/groups/${encodeURIComponent(groupId)}/admin/invite-link/rotate`,
      {}
    );
  }

  removeParticipant(groupId: string, participantId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/groups/${encodeURIComponent(groupId)}/admin/participants/${encodeURIComponent(participantId)}`
    );
  }

  executeDraw(groupId: string): Observable<AdminGroupView> {
    return this.http.post<AdminGroupView>(
      `${this.baseUrl}/groups/${encodeURIComponent(groupId)}/admin/draw`,
      {}
    );
  }

  generatePasswordResetToken(groupId: string, participantId: string): Observable<PasswordResetLinkView> {
    return this.http.post<PasswordResetLinkView>(
      `${this.baseUrl}/groups/${encodeURIComponent(groupId)}/admin/participants/${encodeURIComponent(participantId)}/reset-token`,
      {}
    );
  }
}
