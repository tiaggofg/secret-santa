import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthSessionStore } from '../auth/auth-session.store';
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
  ResetPinRequest,
  RevealMatchRequest,
  RevealMatchView,
  UpdateGroupPinRequest
} from './secret-santa-api.models';

@Injectable({
  providedIn: 'root'
})
export class SecretSantaApiService {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthSessionStore);
  private readonly baseUrl = '/api/v1';

  register(request: RegisterUserRequest): Observable<AuthSessionView> {
    return this.http.post<AuthSessionView>(`${this.baseUrl}/auth/register`, request);
  }

  login(request: LoginUserRequest): Observable<AuthSessionView> {
    return this.http.post<AuthSessionView>(`${this.baseUrl}/auth/login`, request);
  }

  resetPin(request: ResetPinRequest): Observable<PinResetResultView> {
    return this.http.post<PinResetResultView>(`${this.baseUrl}/auth/reset-pin`, request);
  }

  listGroups(): Observable<GroupDiscoveryView> {
    return this.http.get<GroupDiscoveryView>(`${this.baseUrl}/groups`, {
      headers: this.buildAuthHeaders()
    });
  }

  createGroup(request: CreateGroupRequest): Observable<AdminGroupView> {
    return this.http.post<AdminGroupView>(`${this.baseUrl}/groups`, request, {
      headers: this.buildAuthHeaders()
    });
  }

  getPublicGroup(groupId: string): Observable<PublicGroupView> {
    return this.http.get<PublicGroupView>(`${this.baseUrl}/groups/${encodeURIComponent(groupId)}`, {
      headers: this.buildAuthHeaders()
    });
  }

  joinGroup(groupId: string, request: JoinGroupRequest): Observable<ParticipantRegistrationView> {
    return this.http.post<ParticipantRegistrationView>(
      `${this.baseUrl}/groups/${encodeURIComponent(groupId)}/participants`,
      request,
      {
        headers: this.buildAuthHeaders()
      }
    );
  }

  revealMatch(groupId: string, request: RevealMatchRequest): Observable<RevealMatchView> {
    return this.http.post<RevealMatchView>(
      `${this.baseUrl}/groups/${encodeURIComponent(groupId)}/participants/reveal`,
      request
    );
  }

  getAdminGroup(groupId: string): Observable<AdminGroupView> {
    return this.http.get<AdminGroupView>(`${this.baseUrl}/groups/${encodeURIComponent(groupId)}/admin`, {
      headers: this.buildAuthHeaders()
    });
  }

  updateGroupPin(groupId: string, request: UpdateGroupPinRequest): Observable<void> {
    return this.http.put<void>(
      `${this.baseUrl}/groups/${encodeURIComponent(groupId)}/admin/pin`,
      request,
      {
        headers: this.buildAuthHeaders()
      }
    );
  }

  removeParticipant(groupId: string, participantId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/groups/${encodeURIComponent(groupId)}/admin/participants/${encodeURIComponent(participantId)}`,
      {
        headers: this.buildAuthHeaders()
      }
    );
  }

  executeDraw(groupId: string): Observable<AdminGroupView> {
    return this.http.post<AdminGroupView>(
      `${this.baseUrl}/groups/${encodeURIComponent(groupId)}/admin/draw`,
      {},
      {
        headers: this.buildAuthHeaders()
      }
    );
  }

  generatePasswordResetToken(groupId: string, participantId: string): Observable<PasswordResetLinkView> {
    return this.http.post<PasswordResetLinkView>(
      `${this.baseUrl}/groups/${encodeURIComponent(groupId)}/admin/participants/${encodeURIComponent(participantId)}/reset-token`,
      {},
      {
        headers: this.buildAuthHeaders()
      }
    );
  }

  private buildAuthHeaders(): HttpHeaders {
    const token = this.authStore.token();
    if (!token) {
      return new HttpHeaders();
    }
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }
}
