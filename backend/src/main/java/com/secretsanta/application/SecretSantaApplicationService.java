package com.secretsanta.application;

import com.secretsanta.domain.exception.DomainValidationException;
import com.secretsanta.domain.exception.DuplicateUsernameException;
import com.secretsanta.domain.exception.GroupNotDrawnYetException;
import com.secretsanta.domain.exception.InvalidCredentialsException;
import com.secretsanta.domain.exception.InvalidInviteSignatureException;
import com.secretsanta.domain.exception.InvalidPasswordResetTokenException;
import com.secretsanta.domain.exception.ResourceNotFoundException;
import com.secretsanta.domain.model.GeoCoordinates;
import com.secretsanta.domain.model.GroupStatus;
import com.secretsanta.domain.model.InviteSignature;
import com.secretsanta.domain.model.Participant;
import com.secretsanta.domain.model.ParticipantName;
import com.secretsanta.domain.model.PasswordResetTokenHash;
import com.secretsanta.domain.model.PasswordValidator;
import com.secretsanta.domain.model.PinHash;
import com.secretsanta.domain.model.RefreshToken;
import com.secretsanta.domain.model.RevealStatus;
import com.secretsanta.domain.model.SecretSantaGroup;
import com.secretsanta.domain.model.UserAccount;
import com.secretsanta.domain.model.Username;
import com.secretsanta.domain.port.RefreshTokenRepository;
import com.secretsanta.domain.port.SecretSantaGroupRepository;
import com.secretsanta.domain.port.UserAccountRepository;
import com.secretsanta.domain.service.DerangementDrawService;
import com.secretsanta.domain.service.HouseholdClusterService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class SecretSantaApplicationService {

    private static final int MAX_OPTIMISTIC_LOCK_RETRIES = 3;
    private static final Duration RESET_TOKEN_TTL = Duration.ofHours(24);
    private static final Duration DEFAULT_REFRESH_TOKEN_TTL = Duration.ofMinutes(60);
    private static final int REFRESH_TOKEN_BYTES = 32;

    private final UserAccountRepository userAccountRepository;
    private final SecretSantaGroupRepository groupRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final StatelessSessionTokenService tokenService;
    private final HouseholdClusterService clusterService;
    private final DerangementDrawService drawService;
    private final PasswordEncoder passwordEncoder;
    private final Duration refreshTokenTtl;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    @Autowired
    public SecretSantaApplicationService(
            UserAccountRepository userAccountRepository,
            SecretSantaGroupRepository groupRepository,
            RefreshTokenRepository refreshTokenRepository,
            StatelessSessionTokenService tokenService,
            @Value("${secretsanta.security.refresh-token-ttl-minutes:60}") long refreshTokenTtlMinutes) {
        this(
                userAccountRepository,
                groupRepository,
                refreshTokenRepository,
                tokenService,
                new HouseholdClusterService(),
                new DerangementDrawService(),
                new BCryptPasswordEncoder(),
                Duration.ofMinutes(refreshTokenTtlMinutes),
                Clock.systemUTC());
    }

    public SecretSantaApplicationService(
            UserAccountRepository userAccountRepository,
            SecretSantaGroupRepository groupRepository,
            StatelessSessionTokenService tokenService,
            HouseholdClusterService clusterService,
            DerangementDrawService drawService,
            PasswordEncoder passwordEncoder,
            Clock clock) {
        this(
                userAccountRepository,
                groupRepository,
                null,
                tokenService,
                clusterService,
                drawService,
                passwordEncoder,
                DEFAULT_REFRESH_TOKEN_TTL,
                clock);
    }

    public SecretSantaApplicationService(
            UserAccountRepository userAccountRepository,
            SecretSantaGroupRepository groupRepository,
            RefreshTokenRepository refreshTokenRepository,
            StatelessSessionTokenService tokenService,
            HouseholdClusterService clusterService,
            DerangementDrawService drawService,
            PasswordEncoder passwordEncoder,
            Duration refreshTokenTtl,
            Clock clock) {
        this.userAccountRepository = Objects.requireNonNull(userAccountRepository, "userAccountRepository must not be null");
        this.groupRepository = Objects.requireNonNull(groupRepository, "groupRepository must not be null");
        this.refreshTokenRepository = refreshTokenRepository;
        this.tokenService = Objects.requireNonNull(tokenService, "tokenService must not be null");
        this.clusterService = Objects.requireNonNull(clusterService, "clusterService must not be null");
        this.drawService = Objects.requireNonNull(drawService, "drawService must not be null");
        this.passwordEncoder = Objects.requireNonNull(passwordEncoder, "passwordEncoder must not be null");
        this.refreshTokenTtl = Objects.requireNonNull(refreshTokenTtl, "refreshTokenTtl must not be null");
        this.clock = Objects.requireNonNull(clock, "clock must not be null");
    }

    public long refreshTokenTtlSeconds() {
        return refreshTokenTtl.toSeconds();
    }

    public AuthSessionResult registerUserWithTokens(String name, String username, String rawPassword) {
        ParticipantName participantName = new ParticipantName(name);
        Username normalizedUsername = new Username(username);
        PasswordValidator.validateRawPassword(rawPassword);

        if (userAccountRepository.existsByUsername(normalizedUsername)) {
            throw new DuplicateUsernameException("Username '" + normalizedUsername.value() + "' is already taken");
        }

        PinHash passwordHash = new PinHash(passwordEncoder.encode(rawPassword));
        Instant now = Instant.now(clock);
        UserAccount account = UserAccount.register(participantName, normalizedUsername, passwordHash, now);

        final UserAccount saved;
        try {
            saved = userAccountRepository.save(account);
        } catch (DuplicateKeyException ex) {
            throw new DuplicateUsernameException("Username '" + normalizedUsername.value() + "' is already taken");
        }

        return issueSessionTokens(saved, now, UUID.randomUUID());
    }

    public AuthSessionView registerUser(String name, String username, String rawPassword) {
        AuthSessionResult result = registerUserWithTokens(name, username, rawPassword);
        return new AuthSessionView(result.accessToken(), result.userId(), result.name(), result.username());
    }

    public AuthSessionResult loginUserWithTokens(String username, String rawPassword) {
        if (username == null || username.isBlank() || rawPassword == null || rawPassword.isBlank()) {
            throw new InvalidCredentialsException("Invalid username or password");
        }
        final Username normalizedUsername;
        try {
            normalizedUsername = new Username(username);
        } catch (DomainValidationException ex) {
            throw new InvalidCredentialsException("Invalid username or password");
        }

        UserAccount user = userAccountRepository.findByUsername(normalizedUsername)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid username or password"));

        if (!passwordEncoder.matches(rawPassword, user.pinHash().value())) {
            throw new InvalidCredentialsException("Invalid username or password");
        }

        Instant now = Instant.now(clock);
        return issueSessionTokens(user, now, UUID.randomUUID());
    }

    public AuthSessionView loginUser(String username, String rawPassword) {
        AuthSessionResult result = loginUserWithTokens(username, rawPassword);
        return new AuthSessionView(result.accessToken(), result.userId(), result.name(), result.username());
    }

    public AuthSessionResult refreshSession(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new InvalidCredentialsException("Refresh token is required");
        }
        if (refreshTokenRepository == null) {
            throw new IllegalStateException("RefreshTokenRepository is not configured");
        }

        String tokenHash = hashSha256Hex(rawRefreshToken.trim());
        RefreshToken existing = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid refresh token"));

        Instant now = Instant.now(clock);
        if (existing.isRevoked()) {
            refreshTokenRepository.revokeFamily(existing.familyId(), now);
            throw new InvalidCredentialsException("Refresh token has been revoked");
        }
        if (existing.isExpired(now)) {
            throw new InvalidCredentialsException("Refresh token has expired");
        }

        UserAccount user = userAccountRepository.findById(existing.userId())
                .orElseThrow(() -> new InvalidCredentialsException("Authenticated user account not found"));

        refreshTokenRepository.save(existing.revoke(now));
        return issueSessionTokens(user, now, existing.familyId());
    }

    public void logoutSession(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank() || refreshTokenRepository == null) {
            return;
        }
        String tokenHash = hashSha256Hex(rawRefreshToken.trim());
        refreshTokenRepository.findByTokenHash(tokenHash).ifPresent(token -> {
            if (!token.isRevoked()) {
                refreshTokenRepository.save(token.revoke(Instant.now(clock)));
            }
        });
    }

    public AuthUserView getCurrentUser(UUID userId) {
        if (userId == null) {
            throw new InvalidCredentialsException("Authentication is required");
        }
        UserAccount user = userAccountRepository.findById(userId)
                .orElseThrow(() -> new InvalidCredentialsException("Authenticated user account not found"));
        return new AuthUserView(user.id(), user.name().value(), user.username().value());
    }

    private AuthSessionResult issueSessionTokens(UserAccount user, Instant now, UUID familyId) {
        String accessToken = tokenService.issueToken(user.id(), user.username().value(), now);
        String rawRefreshToken = generateRandomToken(REFRESH_TOKEN_BYTES);
        if (refreshTokenRepository != null) {
            RefreshToken refreshToken = RefreshToken.issue(
                    user.id(),
                    familyId,
                    hashSha256Hex(rawRefreshToken),
                    now.plus(refreshTokenTtl),
                    now);
            refreshTokenRepository.save(refreshToken);
        }
        return new AuthSessionResult(
                user.id(),
                user.name().value(),
                user.username().value(),
                accessToken,
                rawRefreshToken);
    }

    private String generateRandomToken(int byteLength) {
        byte[] randomBytes = new byte[byteLength];
        secureRandom.nextBytes(randomBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
    }

    public GroupDiscoveryView listGroupsForUser(UUID userId) {
        if (userId == null) {
            throw new InvalidCredentialsException("Authentication is required to list groups");
        }
        List<GroupSummaryView> myGroups = groupRepository
                .findByUserParticipationOrOrganizationOrderByCreatedAtDesc(userId)
                .stream()
                .map(g -> toGroupSummaryView(g, userId))
                .toList();

        return new GroupDiscoveryView(myGroups);
    }

    public AdminGroupView createGroup(UUID organizerUserId, String eventName) {
        if (organizerUserId == null) {
            throw new InvalidCredentialsException("Authentication is required to create a group");
        }
        userAccountRepository.findById(organizerUserId)
                .orElseThrow(() -> new InvalidCredentialsException("Authenticated user account not found"));

        UUID groupId = UUID.randomUUID();
        InviteSignature inviteSignature = tokenService.generateInviteSignature(groupId);
        Instant now = Instant.now(clock);
        SecretSantaGroup group = SecretSantaGroup.create(groupId, eventName, inviteSignature, organizerUserId, now);
        SecretSantaGroup saved = groupRepository.save(group);
        return toAdminGroupView(saved);
    }

    public PublicGroupView getPublicGroup(UUID groupId) {
        return getPublicGroup(groupId, null, null);
    }

    public PublicGroupView getPublicGroup(UUID groupId, UUID currentUserId) {
        return getPublicGroup(groupId, currentUserId, null);
    }

    public PublicGroupView getPublicGroup(UUID groupId, UUID currentUserId, String inviteSignature) {
        SecretSantaGroup group = loadGroupById(groupId);
        return toPublicGroupView(group, currentUserId, inviteSignature);
    }

    public AdminGroupView getAdminGroup(UUID groupId, UUID requesterUserId) {
        if (requesterUserId == null) {
            throw new InvalidCredentialsException("Authentication is required for group administration");
        }
        SecretSantaGroup group = loadGroupById(groupId);
        group.assertOrganizer(requesterUserId);
        return toAdminGroupView(group);
    }

    public AdminGroupView rotateInviteSignature(UUID groupId, UUID requesterUserId) {
        if (requesterUserId == null) {
            throw new InvalidCredentialsException("Authentication is required for group administration");
        }
        SecretSantaGroup group = loadGroupById(groupId);
        group.assertOrganizer(requesterUserId);
        InviteSignature newSignature = tokenService.generateInviteSignature(group.id());
        group.rotateInviteSignature(newSignature);
        SecretSantaGroup saved = groupRepository.save(group);
        return toAdminGroupView(saved);
    }

    public ParticipantRegistrationView registerParticipant(
            UUID groupId,
            UUID userId,
            String inviteSignature,
            Double latitude,
            Double longitude) {
        if (userId == null) {
            throw new InvalidCredentialsException("Authentication is required to join a group");
        }
        UserAccount user = userAccountRepository.findById(userId)
                .orElseThrow(() -> new InvalidCredentialsException("Authenticated user account not found"));

        GeoCoordinates coordinates = buildCoordinates(latitude, longitude);
        return registerParticipantWithOptimisticRetry(groupId, user, inviteSignature, coordinates);
    }

    public VisitorJoinResult registerVisitorAndJoinGroupWithTokens(
            UUID groupId,
            String name,
            String username,
            String rawPassword,
            String inviteSignature,
            Double latitude,
            Double longitude) {
        GeoCoordinates coordinates = buildCoordinates(latitude, longitude);
        SecretSantaGroup group = loadGroupById(groupId);

        final AuthSessionResult authSession;
        if (name != null && !name.isBlank()) {
            verifyInviteSignature(group, inviteSignature);
            authSession = registerUserWithTokens(name, username, rawPassword);
        } else {
            authSession = loginUserWithTokens(username, rawPassword);
            SecretSantaGroup latestGroup = loadGroupById(groupId);
            if (latestGroup.hasParticipantWithUserId(authSession.userId())) {
                throw new AlreadyParticipantAuthenticatedException(
                        authSession.userId(),
                        authSession.name(),
                        authSession.username(),
                        latestGroup.id(),
                        authSession.accessToken(),
                        authSession.refreshToken());
            }
            if (!latestGroup.isOrganizer(authSession.userId())) {
                verifyInviteSignature(latestGroup, inviteSignature);
            }
        }

        UserAccount user = userAccountRepository.findById(authSession.userId())
                .orElseThrow(() -> new InvalidCredentialsException("Authenticated user account not found"));
        ParticipantRegistrationView view = registerParticipantWithOptimisticRetry(
                groupId,
                user,
                inviteSignature,
                coordinates);
        return new VisitorJoinResult(view, authSession.accessToken(), authSession.refreshToken());
    }

    public ParticipantRegistrationView registerVisitorAndJoinGroup(
            UUID groupId,
            String name,
            String username,
            String rawPassword,
            String inviteSignature,
            Double latitude,
            Double longitude) {
        return registerVisitorAndJoinGroupWithTokens(
                groupId, name, username, rawPassword, inviteSignature, latitude, longitude)
                .participant();
    }

    private ParticipantRegistrationView registerParticipantWithOptimisticRetry(
            UUID groupId,
            UserAccount user,
            String inviteSignature,
            GeoCoordinates coordinates) {
        OptimisticLockingFailureException lastFailure = null;
        for (int attempt = 1; attempt <= MAX_OPTIMISTIC_LOCK_RETRIES; attempt++) {
            try {
                SecretSantaGroup group = loadGroupById(groupId);
                if (!group.isOrganizer(user.id())) {
                    verifyInviteSignature(group, inviteSignature);
                }
                Instant now = Instant.now(clock);
                Participant participant = group.registerParticipant(
                        user.id(),
                        user.name(),
                        user.username(),
                        coordinates,
                        now);
                SecretSantaGroup savedGroup = groupRepository.save(group);
                Participant savedParticipant = savedGroup.findParticipantById(participant.id());
                return new ParticipantRegistrationView(
                        savedParticipant.id(),
                        savedParticipant.userId(),
                        savedParticipant.name().value(),
                        savedParticipant.username().value(),
                        savedParticipant.hasGeoLocation(),
                        savedParticipant.revealStatus(savedGroup.status()),
                        savedParticipant.createdAt(),
                        savedGroup.id(),
                        "/g/" + savedGroup.id());
            } catch (OptimisticLockingFailureException ex) {
                lastFailure = ex;
            }
        }
        throw lastFailure;
    }

    public void removeParticipant(UUID groupId, UUID requesterUserId, UUID participantId) {
        if (requesterUserId == null) {
            throw new InvalidCredentialsException("Authentication is required for group administration");
        }
        if (participantId == null) {
            throw new DomainValidationException("Participant ID must not be null");
        }
        SecretSantaGroup group = loadGroupById(groupId);
        group.assertOrganizer(requesterUserId);
        group.removeParticipant(participantId);
        groupRepository.save(group);
    }

    public AdminGroupView executeDraw(UUID groupId, UUID requesterUserId) {
        if (requesterUserId == null) {
            throw new InvalidCredentialsException("Authentication is required for group administration");
        }
        SecretSantaGroup group = loadGroupById(groupId);
        group.assertOrganizer(requesterUserId);
        Instant now = Instant.now(clock);
        group.executeDraw(clusterService, drawService, now);
        SecretSantaGroup saved = groupRepository.save(group);
        return toAdminGroupView(saved);
    }

    public PasswordResetLinkView generatePasswordResetToken(
            UUID groupId,
            UUID requesterUserId,
            UUID participantId) {
        if (requesterUserId == null) {
            throw new InvalidCredentialsException("Authentication is required for group administration");
        }
        if (participantId == null) {
            throw new DomainValidationException("Participant ID must not be null");
        }
        SecretSantaGroup group = loadGroupById(groupId);
        group.assertOrganizer(requesterUserId);
        Participant participant = group.findParticipantById(participantId);

        UserAccount userAccount = userAccountRepository.findById(participant.userId())
                .orElseThrow(() -> new ResourceNotFoundException("User account not found for participant"));

        byte[] randomBytes = new byte[24];
        secureRandom.nextBytes(randomBytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
        PasswordResetTokenHash tokenHash = hashResetToken(rawToken);
        Instant expiresAt = Instant.now(clock).plus(RESET_TOKEN_TTL);

        userAccount.issuePasswordResetToken(tokenHash, expiresAt);
        userAccountRepository.save(userAccount);

        String resetPath = "/reset/" + rawToken;
        return new PasswordResetLinkView(
                participant.id(),
                userAccount.id(),
                userAccount.username().value(),
                rawToken,
                resetPath,
                expiresAt);
    }

    public PinResetResultView resetPasswordWithToken(String rawToken, String newRawPassword) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new InvalidPasswordResetTokenException("Reset token is invalid or has expired");
        }
        PasswordValidator.validateRawPassword(newRawPassword);

        PasswordResetTokenHash tokenHash = hashResetToken(rawToken.trim());
        UserAccount userAccount = userAccountRepository.findByResetTokenHash(tokenHash)
                .orElseThrow(() -> new InvalidPasswordResetTokenException("Reset token is invalid or has expired"));

        PinHash newPasswordHash = new PinHash(passwordEncoder.encode(newRawPassword));
        Instant now = Instant.now(clock);
        userAccount.resetPinWithToken(tokenHash, newPasswordHash, now);
        userAccountRepository.save(userAccount);

        if (refreshTokenRepository != null) {
            refreshTokenRepository.revokeAllByUserId(userAccount.id(), now);
        }

        return new PinResetResultView(userAccount.id(), userAccount.username().value(), "Password updated successfully");
    }

    public PinResetResultView resetPinWithToken(String rawToken, String newRawPassword) {
        return resetPasswordWithToken(rawToken, newRawPassword);
    }

    public RevealMatchView revealMatch(UUID groupId, String usernameValue, String rawPassword) {
        OptimisticLockingFailureException lastFailure = null;
        for (int attempt = 1; attempt <= MAX_OPTIMISTIC_LOCK_RETRIES; attempt++) {
            try {
                SecretSantaGroup group = loadGroupById(groupId);
                if (group.status() != GroupStatus.DRAWN) {
                    throw new GroupNotDrawnYetException("The Secret Santa draw has not been executed yet");
                }
                if (usernameValue == null || usernameValue.isBlank() || rawPassword == null || rawPassword.isBlank()) {
                    throw new InvalidCredentialsException("Invalid username or password");
                }

                final Username username;
                try {
                    username = new Username(usernameValue);
                } catch (DomainValidationException ex) {
                    throw new InvalidCredentialsException("Invalid username or password");
                }

                final Participant participant;
                try {
                    participant = group.findParticipantByUsername(username);
                } catch (ResourceNotFoundException ex) {
                    throw new InvalidCredentialsException("Invalid username or password");
                }

                UserAccount userAccount = userAccountRepository.findById(participant.userId())
                        .or(() -> userAccountRepository.findByUsername(username))
                        .orElseThrow(() -> new InvalidCredentialsException("Invalid username or password"));

                if (!passwordEncoder.matches(rawPassword, userAccount.pinHash().value())) {
                    throw new InvalidCredentialsException("Invalid username or password");
                }

                Instant now = Instant.now(clock);
                String drawnParticipantName = group.markRevealedAndGetDrawnName(participant.id(), now);
                SecretSantaGroup saved = groupRepository.save(group);
                Participant updatedParticipant = saved.findParticipantById(participant.id());

                return new RevealMatchView(
                        updatedParticipant.id(),
                        updatedParticipant.username().value(),
                        drawnParticipantName,
                        updatedParticipant.revealedAt());
            } catch (OptimisticLockingFailureException ex) {
                lastFailure = ex;
            }
        }
        throw lastFailure;
    }

    private SecretSantaGroup loadGroupById(UUID groupId) {
        if (groupId == null) {
            throw new ResourceNotFoundException("Group not found");
        }
        return groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found: " + groupId));
    }

    private static void verifyInviteSignature(SecretSantaGroup group, String candidateSignature) {
        if (!group.inviteSignature().matchesConstantTime(candidateSignature)) {
            throw new InvalidInviteSignatureException("Invalid or expired group invite link");
        }
    }

    private static GeoCoordinates buildCoordinates(Double latitude, Double longitude) {
        if (latitude == null && longitude == null) {
            return null;
        }
        if (latitude == null || longitude == null) {
            throw new DomainValidationException("Both latitude and longitude must be provided together");
        }
        return new GeoCoordinates(latitude, longitude);
    }

    public static PasswordResetTokenHash hashResetToken(String rawToken) {
        return new PasswordResetTokenHash(hashSha256Hex(rawToken));
    }

    public static String hashSha256Hex(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 algorithm not available", ex);
        }
    }

    private static GroupSummaryView toGroupSummaryView(SecretSantaGroup group, UUID userId) {
        boolean isOrganizer = group.isOrganizer(userId);
        boolean joined = group.hasParticipantWithUserId(userId);
        return new GroupSummaryView(
                group.id(),
                group.eventName(),
                group.organizerUserId(),
                group.status(),
                group.participants().size(),
                isOrganizer,
                joined,
                "/g/" + group.id(),
                group.createdAt(),
                group.drawnAt());
    }

    private static AdminGroupView toAdminGroupView(SecretSantaGroup group) {
        List<AdminParticipantView> participants = group.participants().stream()
                .map(p -> new AdminParticipantView(
                        p.id(),
                        p.userId(),
                        p.name().value(),
                        p.username().value(),
                        p.hasGeoLocation(),
                        p.revealStatus(group.status()),
                        p.createdAt()))
                .toList();
        return new AdminGroupView(
                group.id(),
                group.eventName(),
                group.organizerUserId(),
                group.status(),
                group.geographicRestrictionRelaxed(),
                "/g/" + group.id() + "?sig=" + group.inviteSignature().value(),
                group.createdAt(),
                group.drawnAt(),
                participants);
    }

    private static PublicGroupView toPublicGroupView(
            SecretSantaGroup group,
            UUID currentUserId,
            String candidateSignature) {
        boolean isOrganizer = group.isOrganizer(currentUserId);
        boolean joined = group.hasParticipantWithUserId(currentUserId);
        boolean inviteValid = isOrganizer || joined || group.inviteSignature().matchesConstantTime(candidateSignature);
        boolean participantsVisible = isOrganizer || joined;
        List<PublicParticipantView> participants = participantsVisible
                ? group.participants().stream()
                        .map(p -> new PublicParticipantView(
                                p.id(),
                                p.userId(),
                                p.name().value(),
                                p.username().value(),
                                p.hasGeoLocation(),
                                p.revealStatus(group.status()),
                                p.createdAt()))
                        .toList()
                : List.of();
        return new PublicGroupView(
                group.id(),
                group.eventName(),
                group.organizerUserId(),
                group.status(),
                group.geographicRestrictionRelaxed(),
                "/g/" + group.id(),
                isOrganizer,
                joined,
                inviteValid,
                participantsVisible,
                group.participants().size(),
                group.createdAt(),
                group.drawnAt(),
                participants);
    }

    public record AuthUserView(
            UUID userId,
            String name,
            String username) {
    }

    public record AuthSessionResult(
            UUID userId,
            String name,
            String username,
            String accessToken,
            String refreshToken) {

        public AuthUserView toUserView() {
            return new AuthUserView(userId, name, username);
        }
    }

    public record VisitorJoinResult(
            ParticipantRegistrationView participant,
            String accessToken,
            String refreshToken) {
    }

    public record AuthSessionView(
            String token,
            UUID userId,
            String name,
            String username) {
    }

    public record GroupSummaryView(
            UUID id,
            String eventName,
            UUID organizerUserId,
            GroupStatus status,
            int participantCount,
            boolean organizer,
            boolean joined,
            String sharePath,
            Instant createdAt,
            Instant drawnAt) {
    }

    public record GroupDiscoveryView(
            List<GroupSummaryView> myGroups) {
    }

    public record AdminParticipantView(
            UUID id,
            UUID userId,
            String name,
            String username,
            boolean hasGeoLocation,
            RevealStatus revealStatus,
            Instant createdAt) {
    }

    public record AdminGroupView(
            UUID id,
            String eventName,
            UUID organizerUserId,
            GroupStatus status,
            boolean geographicRestrictionRelaxed,
            String sharePath,
            Instant createdAt,
            Instant drawnAt,
            List<AdminParticipantView> participants) {
    }

    public record PublicParticipantView(
            UUID id,
            UUID userId,
            String name,
            String username,
            boolean hasGeoLocation,
            RevealStatus revealStatus,
            Instant createdAt) {
    }

    public record PublicGroupView(
            UUID id,
            String eventName,
            UUID organizerUserId,
            GroupStatus status,
            boolean geographicRestrictionRelaxed,
            String sharePath,
            boolean organizer,
            boolean joined,
            boolean inviteValid,
            boolean participantsVisible,
            int participantCount,
            Instant createdAt,
            Instant drawnAt,
            List<PublicParticipantView> participants) {
    }

    public record ParticipantRegistrationView(
            UUID id,
            UUID userId,
            String name,
            String username,
            boolean hasGeoLocation,
            RevealStatus revealStatus,
            Instant createdAt,
            UUID groupId,
            String sharePath) {
    }

    public record PasswordResetLinkView(
            UUID participantId,
            UUID userId,
            String username,
            String resetToken,
            String resetPath,
            Instant expiresAt) {
    }

    public record PinResetResultView(
            UUID userId,
            String username,
            String message) {
    }

    public record RevealMatchView(
            UUID participantId,
            String username,
            String drawnParticipantName,
            Instant revealedAt) {
    }
}
