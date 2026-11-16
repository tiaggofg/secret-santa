export type GroupStatus = 'OPEN' | 'DRAWN';
export type RevealStatus = 'WAITING_DRAW' | 'PENDING_REVEAL' | 'REVEALED';

export interface RegisterUserRequest {
  name: string;
  username: string;
  pin: string;
}

export interface LoginUserRequest {
  username: string;
  pin: string;
}

export interface ResetPinRequest {
  token: string;
  newPin: string;
}

export interface AuthSessionView {
  token: string;
  userId: string;
  name: string;
  username: string;
}

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
  pin?: string;
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
  token: string | null;
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
  username: string;
  pin: string;
}

export interface RevealMatchView {
  participantId: string;
  username: string;
  drawnParticipantName: string;
  revealedAt: string;
}
