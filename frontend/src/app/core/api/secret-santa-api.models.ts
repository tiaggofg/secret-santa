export type GroupStatus = 'OPEN' | 'DRAWN';
export type RevealStatus = 'WAITING_DRAW' | 'PENDING_REVEAL' | 'REVEALED';

export interface RegisterUserRequest {
  name: string;
  username: string;
  password: string;
}

export interface LoginUserRequest {
  username: string;
  password: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface AuthSessionView {
  userId: string;
  name: string;
  username: string;
}

export type AuthUserView = AuthSessionView;

export interface GroupSummaryView {
  id: string;
  eventName: string;
  organizerUserId: string;
  status: GroupStatus;
  participantCount: number;
  organizer: boolean;
  joined: boolean;
  sharePath: string;
  createdAt: string;
  drawnAt: string | null;
}

export interface GroupDiscoveryView {
  myGroups: GroupSummaryView[];
}

export interface CreateGroupRequest {
  eventName: string;
}

export interface AdminParticipantView {
  id: string;
  userId: string;
  name: string;
  username: string;
  hasGeoLocation: boolean;
  revealStatus: RevealStatus;
  createdAt: string;
}

export interface AdminGroupView {
  id: string;
  eventName: string;
  organizerUserId: string;
  status: GroupStatus;
  geographicRestrictionRelaxed: boolean;
  sharePath: string;
  createdAt: string;
  drawnAt: string | null;
  participants: AdminParticipantView[];
}

export interface PublicParticipantView {
  id: string;
  userId: string;
  name: string;
  username: string;
  hasGeoLocation: boolean;
  revealStatus: RevealStatus;
  createdAt: string;
}

export interface PublicGroupView {
  id: string;
  eventName: string;
  organizerUserId: string;
  status: GroupStatus;
  geographicRestrictionRelaxed: boolean;
  sharePath: string;
  organizer: boolean;
  joined: boolean;
  inviteValid: boolean;
  participantsVisible: boolean;
  participantCount: number;
  createdAt: string;
  drawnAt: string | null;
  participants: PublicParticipantView[];
}

export interface JoinGroupRequest {
  name?: string;
  username?: string;
  password?: string;
  inviteSignature?: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ParticipantRegistrationView {
  id: string;
  userId: string;
  name: string;
  username: string;
  hasGeoLocation: boolean;
  revealStatus: RevealStatus;
  createdAt: string;
  groupId: string;
  sharePath: string;
}

export interface PasswordResetLinkView {
  participantId: string;
  userId: string;
  username: string;
  resetToken: string;
  resetPath: string;
  expiresAt: string;
}

export interface PinResetResultView {
  userId: string;
  username: string;
  message: string;
}

export interface RevealMatchRequest {
  password: string;
}

export interface RevealMatchView {
  participantId: string;
  username: string;
  drawnParticipantName: string;
  revealedAt: string;
}
