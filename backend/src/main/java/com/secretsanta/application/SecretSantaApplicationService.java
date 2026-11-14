package com.secretsanta.application;

import com.secretsanta.domain.exception.DomainValidationException;
import com.secretsanta.domain.exception.DuplicateUsernameException;
import com.secretsanta.domain.exception.GroupNotDrawnYetException;
import com.secretsanta.domain.exception.InvalidCredentialsException;
import com.secretsanta.domain.exception.InvalidPasswordResetTokenException;
import com.secretsanta.domain.exception.ResourceNotFoundException;
import com.secretsanta.domain.model.GeoCoordinates;
import com.secretsanta.domain.model.GroupSlug;
import com.secretsanta.domain.model.GroupStatus;
import com.secretsanta.domain.model.Participant;
import com.secretsanta.domain.model.ParticipantName;
import com.secretsanta.domain.model.PasswordResetTokenHash;
import com.secretsanta.domain.model.PinHash;
import com.secretsanta.domain.model.PinValidator;
import com.secretsanta.domain.model.RevealStatus;
import com.secretsanta.domain.model.SecretSantaGroup;
import com.secretsanta.domain.model.UserAccount;
import com.secretsanta.domain.model.Username;
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
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class SecretSantaApplicationService {

    private static final int MAX_OPTIMISTIC_LOCK_RETRIES = 3;
    private static final Duration RESET_TOKEN_TTL = Duration.ofHours(24);

    private final UserAccountRepository userAccountRepository;
    private final SecretSantaGroupRepository groupRepository;
    private final StatelessSessionTokenService tokenService;
    private final HouseholdClusterService clusterService;
    private final DerangementDrawService drawService;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    @Autowired
    public SecretSantaApplicationService(
            UserAccountRepository userAccountRepository,
            SecretSantaGroupRepository groupRepository,
            StatelessSessionTokenService tokenService) {
        this(
                userAccountRepository,
                groupRepository,
                tokenService,
                new HouseholdClusterService(),
                new DerangementDrawService(),
                new BCryptPasswordEncoder(),
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
        this.userAccountRepository = Objects.requireNonNull(userAccountRepository, "userAccountRepository must not be null");
        this.groupRepository = Objects.requireNonNull(groupRepository, "groupRepository must not be null");
        this.tokenService = Objects.requireNonNull(tokenService, "tokenService must not be null");
        this.clusterService = Objects.requireNonNull(clusterService, "clusterService must not be null");
        this.drawService = Objects.requireNonNull(drawService, "drawService must not be null");
        this.passwordEncoder = Objects.requireNonNull(passwordEncoder, "passwordEncoder must not be null");
        this.clock = Objects.requireNonNull(clock, "clock must not be null");
    }

    public AuthSessionView registerUser(String name, String username, String rawPin) {
        ParticipantName participantName = new ParticipantName(name);
        Username normalizedUsername = new Username(username);
        PinValidator.validateRawPin(rawPin);

        if (userAccountRepository.existsByUsername(normalizedUsername)) {
            throw new DuplicateUsernameException("Username '" + normalizedUsername.value() + "' is already taken");
        }

        PinHash pinHash = new PinHash(passwordEncoder.encode(rawPin));
        Instant now = Instant.now(clock);
        UserAccount account = UserAccount.register(participantName, normalizedUsername, pinHash, now);

        final UserAccount saved;
        try {
            saved = userAccountRepository.save(account);
        } catch (DuplicateKeyException ex) {
            throw new DuplicateUsernameException("Username '" + normalizedUsername.value() + "' is already taken");
        }

        String token = tokenService.issueToken(saved.id(), saved.username().value(), now);
        return new AuthSessionView(token, saved.id(), saved.name().value(), saved.username().value());
    }

    public AuthSessionView loginUser(String username, String rawPin) {
        if (username == null || username.isBlank() || rawPin == null || rawPin.isBlank()) {
            throw new InvalidCredentialsException("Invalid username or PIN");
        }
        final Username normalizedUsername;
        try {
            normalizedUsername = new Username(username);
        } catch (DomainValidationException ex) {
            throw new InvalidCredentialsException("Invalid username or PIN");
        }

        UserAccount user = userAccountRepository.findByUsername(normalizedUsername)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid username or PIN"));

        if (!passwordEncoder.matches(rawPin, user.pinHash().value())) {
            throw new InvalidCredentialsException("Invalid username or PIN");
        }

        Instant now = Instant.now(clock);
        String token = tokenService.issueToken(user.id(), user.username().value(), now);
        return new AuthSessionView(token, user.id(), user.name().value(), user.username().value());
    }

    public GroupDiscoveryView listGroupsForUser(UUID userId) {
        if (userId == null) {
            throw new InvalidCredentialsException("Authentication is required to list groups");
        }
        List<SecretSantaGroup> allGroups = groupRepository.findAllOrderByCreatedAtDesc();

        List<GroupSummaryView> myGroups = allGroups.stream()
                .filter(g -> g.isOrganizer(userId) || g.hasParticipantWithUserId(userId))
                .map(g -> toGroupSummaryView(g, userId))
                .toList();

        List<GroupSummaryView> availableGroups = allGroups.stream()
                .filter(g -> g.status() == GroupStatus.OPEN && !g.hasParticipantWithUserId(userId))
                .map(g -> toGroupSummaryView(g, userId))
                .toList();

        return new GroupDiscoveryView(myGroups, availableGroups);
    }

    public AdminGroupView createGroup(UUID organizerUserId, String eventName) {
        if (organizerUserId == null) {
            throw new InvalidCredentialsException("Authentication is required to create a group");
        }
        userAccountRepository.findById(organizerUserId)
                .orElseThrow(() -> new InvalidCredentialsException("Authenticated user account not found"));

        Instant now = Instant.now(clock);
        GroupSlug slug = generateUniqueSlug(eventName);
        SecretSantaGroup group = SecretSantaGroup.create(eventName, slug, organizerUserId, now);
        SecretSantaGroup saved = groupRepository.save(group);
        return toAdminGroupView(saved);
    }

    public PublicGroupView getPublicGroup(String slugValue) {
        return getPublicGroup(slugValue, null);
    }

    public PublicGroupView getPublicGroup(String slugValue, UUID currentUserId) {
        SecretSantaGroup group = loadGroupBySlug(slugValue);
        return toPublicGroupView(group, currentUserId);
    }

    public AdminGroupView getAdminGroup(String slugValue, UUID requesterUserId) {
        if (requesterUserId == null) {
            throw new InvalidCredentialsException("Authentication is required for group administration");
        }
        SecretSantaGroup group = loadGroupBySlug(slugValue);
        group.assertOrganizer(requesterUserId);
        return toAdminGroupView(group);
    }

    public ParticipantRegistrationView registerParticipant(
            String slugValue,
            UUID userId,
            Double latitude,
            Double longitude) {
        if (userId == null) {
            throw new InvalidCredentialsException("Authentication is required to join a group");
        }
        UserAccount user = userAccountRepository.findById(userId)
                .orElseThrow(() -> new InvalidCredentialsException("Authenticated user account not found"));

        GeoCoordinates coordinates = buildCoordinates(latitude, longitude);
        return registerParticipantWithOptimisticRetry(slugValue, user, coordinates, null);
    }

    public ParticipantRegistrationView registerVisitorAndJoinGroup(
            String slugValue,
            String name,
            String username,
            String rawPin,
            Double latitude,
            Double longitude) {
        GeoCoordinates coordinates = buildCoordinates(latitude, longitude);
        // Verify the group exists before creating a user account
        loadGroupBySlug(slugValue);

        final AuthSessionView authSession;
        if (name != null && !name.isBlank()) {
            authSession = registerUser(name, username, rawPin);
        } else {
            authSession = loginUser(username, rawPin);
        }

        UserAccount user = userAccountRepository.findById(authSession.userId())
                .orElseThrow(() -> new InvalidCredentialsException("Authenticated user account not found"));
        return registerParticipantWithOptimisticRetry(slugValue, user, coordinates, authSession.token());
    }

    private ParticipantRegistrationView registerParticipantWithOptimisticRetry(
            String slugValue,
            UserAccount user,
            GeoCoordinates coordinates,
            String issuedToken) {
        OptimisticLockingFailureException lastFailure = null;
        for (int attempt = 1; attempt <= MAX_OPTIMISTIC_LOCK_RETRIES; attempt++) {
            try {
                SecretSantaGroup group = loadGroupBySlug(slugValue);
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
                        savedGroup.publicSlug().value(),
                        issuedToken);
            } catch (OptimisticLockingFailureException ex) {
                lastFailure = ex;
            }
        }
        throw lastFailure;
    }

    public void removeParticipant(String slugValue, UUID requesterUserId, UUID participantId) {
        if (requesterUserId == null) {
            throw new InvalidCredentialsException("Authentication is required for group administration");
        }
        if (participantId == null) {
            throw new DomainValidationException("Participant ID must not be null");
        }
        SecretSantaGroup group = loadGroupBySlug(slugValue);
        group.assertOrganizer(requesterUserId);
        group.removeParticipant(participantId);
        groupRepository.save(group);
    }

    public AdminGroupView executeDraw(String slugValue, UUID requesterUserId) {
        if (requesterUserId == null) {
            throw new InvalidCredentialsException("Authentication is required for group administration");
        }
        SecretSantaGroup group = loadGroupBySlug(slugValue);
        group.assertOrganizer(requesterUserId);
        Instant now = Instant.now(clock);
        group.executeDraw(clusterService, drawService, now);
        SecretSantaGroup saved = groupRepository.save(group);
        return toAdminGroupView(saved);
    }

    public PasswordResetLinkView generatePasswordResetToken(
            String slugValue,
            UUID requesterUserId,
            UUID participantId) {
        if (requesterUserId == null) {
            throw new InvalidCredentialsException("Authentication is required for group administration");
        }
        if (participantId == null) {
            throw new DomainValidationException("Participant ID must not be null");
        }
        SecretSantaGroup group = loadGroupBySlug(slugValue);
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

    public PinResetResultView resetPinWithToken(String rawToken, String newRawPin) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new InvalidPasswordResetTokenException("Reset token is invalid or has expired");
        }
        PinValidator.validateRawPin(newRawPin);

        PasswordResetTokenHash tokenHash = hashResetToken(rawToken.trim());
        UserAccount userAccount = userAccountRepository.findByResetTokenHash(tokenHash)
                .orElseThrow(() -> new InvalidPasswordResetTokenException("Reset token is invalid or has expired"));

        PinHash newPinHash = new PinHash(passwordEncoder.encode(newRawPin));
        Instant now = Instant.now(clock);
        userAccount.resetPinWithToken(tokenHash, newPinHash, now);
        userAccountRepository.save(userAccount);

        return new PinResetResultView(userAccount.id(), userAccount.username().value(), "PIN updated successfully");
    }

    public RevealMatchView revealMatch(String slugValue, String usernameValue, String rawPin) {
        OptimisticLockingFailureException lastFailure = null;
        for (int attempt = 1; attempt <= MAX_OPTIMISTIC_LOCK_RETRIES; attempt++) {
            try {
                SecretSantaGroup group = loadGroupBySlug(slugValue);
                if (group.status() != GroupStatus.DRAWN) {
                    throw new GroupNotDrawnYetException("The Secret Santa draw has not been executed yet");
                }
                if (usernameValue == null || usernameValue.isBlank() || rawPin == null || rawPin.isBlank()) {
                    throw new InvalidCredentialsException("Invalid username or PIN");
                }

                final Username username;
                try {
                    username = new Username(usernameValue);
                } catch (DomainValidationException ex) {
                    throw new InvalidCredentialsException("Invalid username or PIN");
                }

                final Participant participant;
                try {
                    participant = group.findParticipantByUsername(username);
                } catch (ResourceNotFoundException ex) {
                    throw new InvalidCredentialsException("Invalid username or PIN");
                }

                UserAccount userAccount = userAccountRepository.findById(participant.userId())
                        .or(() -> userAccountRepository.findByUsername(username))
                        .orElseThrow(() -> new InvalidCredentialsException("Invalid username or PIN"));

                if (!passwordEncoder.matches(rawPin, userAccount.pinHash().value())) {
                    throw new InvalidCredentialsException("Invalid username or PIN");
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

    private SecretSantaGroup loadGroupBySlug(String slugValue) {
        if (slugValue == null || slugValue.isBlank()) {
            throw new ResourceNotFoundException("Group not found");
        }
        final GroupSlug slug;
        try {
            slug = new GroupSlug(slugValue);
        } catch (DomainValidationException ex) {
            throw new ResourceNotFoundException("Group not found: " + slugValue);
        }
        return groupRepository.findByPublicSlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found: " + slug.value()));
    }

    private GroupSlug generateUniqueSlug(String eventName) {
        // Validate eventName first so invalid eventName throws DomainValidationException with clear message
        if (eventName == null || eventName.trim().length() < 3 || eventName.trim().length() > 100) {
            throw new DomainValidationException("Event name must be between 3 and 100 characters");
        }
        for (int attempt = 0; attempt < 10; attempt++) {
            byte[] suffixBytes = new byte[3];
            secureRandom.nextBytes(suffixBytes);
            String suffix = HexFormat.of().formatHex(suffixBytes);
            GroupSlug candidate = GroupSlug.fromEventNameAndSuffix(eventName, suffix);
            if (!groupRepository.existsByPublicSlug(candidate)) {
                return candidate;
            }
        }
        return GroupSlug.fromEventNameAndSuffix(eventName, UUID.randomUUID().toString().substring(0, 8));
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
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return new PasswordResetTokenHash(HexFormat.of().formatHex(hashed));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 algorithm not available", ex);
        }
    }

    private static GroupSummaryView toGroupSummaryView(SecretSantaGroup group, UUID userId) {
        String slug = group.publicSlug().value();
        boolean isOrganizer = group.isOrganizer(userId);
        boolean joined = group.hasParticipantWithUserId(userId);
        return new GroupSummaryView(
                group.id(),
                slug,
                slug,
                group.eventName(),
                group.organizerUserId(),
                group.status(),
                group.participants().size(),
                isOrganizer,
                joined,
                "/g/" + slug,
                group.createdAt(),
                group.drawnAt());
    }

    private static AdminGroupView toAdminGroupView(SecretSantaGroup group) {
        String slug = group.publicSlug().value();
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
                slug,
                slug,
                group.eventName(),
                group.organizerUserId(),
                group.status(),
                group.geographicRestrictionRelaxed(),
                "/g/" + slug,
                group.createdAt(),
                group.drawnAt(),
                participants);
    }

    private static PublicGroupView toPublicGroupView(SecretSantaGroup group, UUID currentUserId) {
        String slug = group.publicSlug().value();
        boolean isOrganizer = group.isOrganizer(currentUserId);
        boolean joined = group.hasParticipantWithUserId(currentUserId);
        List<PublicParticipantView> participants = group.participants().stream()
                .map(p -> new PublicParticipantView(
                        p.id(),
                        p.userId(),
                        p.name().value(),
                        p.username().value(),
                        p.hasGeoLocation(),
                        p.revealStatus(group.status()),
                        p.createdAt()))
                .toList();
        return new PublicGroupView(
                group.id(),
                slug,
                slug,
                group.eventName(),
                group.organizerUserId(),
                group.status(),
                group.geographicRestrictionRelaxed(),
                "/g/" + slug,
                isOrganizer,
                joined,
                group.createdAt(),
                group.drawnAt(),
                participants);
    }

    public record AuthSessionView(
            String token,
            UUID userId,
            String name,
            String username) {
    }

    public record GroupSummaryView(
            UUID id,
            String slug,
            String publicSlug,
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
            List<GroupSummaryView> myGroups,
            List<GroupSummaryView> availableGroups) {
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
            String slug,
            String publicSlug,
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
            String slug,
            String publicSlug,
            String eventName,
            UUID organizerUserId,
            GroupStatus status,
            boolean geographicRestrictionRelaxed,
            String sharePath,
            boolean organizer,
            boolean joined,
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
            String groupSlug,
            String token) {
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
