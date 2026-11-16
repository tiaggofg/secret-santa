package com.secretsanta.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.secretsanta.application.SecretSantaApplicationService.AdminGroupView;
import com.secretsanta.application.SecretSantaApplicationService.AuthSessionResult;
import com.secretsanta.application.SecretSantaApplicationService.AuthSessionView;
import com.secretsanta.application.SecretSantaApplicationService.GroupDiscoveryView;
import com.secretsanta.application.SecretSantaApplicationService.ParticipantRegistrationView;
import com.secretsanta.application.SecretSantaApplicationService.PasswordResetLinkView;
import com.secretsanta.application.SecretSantaApplicationService.PublicGroupView;
import com.secretsanta.application.SecretSantaApplicationService.RevealMatchView;
import com.secretsanta.application.StatelessSessionTokenService.AuthenticatedUser;
import com.secretsanta.config.MongoTestContainerConfig;
import com.secretsanta.domain.exception.DuplicateParticipantException;
import com.secretsanta.domain.exception.DuplicateUsernameException;
import com.secretsanta.domain.exception.GroupAlreadyDrawnException;
import com.secretsanta.domain.exception.GroupNotDrawnYetException;
import com.secretsanta.domain.exception.InvalidCredentialsException;
import com.secretsanta.domain.exception.InvalidInviteSignatureException;
import com.secretsanta.domain.exception.InvalidPasswordResetTokenException;
import com.secretsanta.domain.exception.UnauthorizedOrganizerAccessException;
import com.secretsanta.domain.model.GroupStatus;
import com.secretsanta.domain.model.ParticipantName;
import com.secretsanta.domain.model.PinHash;
import com.secretsanta.domain.model.RevealStatus;
import com.secretsanta.domain.model.SecretSantaGroup;
import com.secretsanta.domain.model.UserAccount;
import com.secretsanta.domain.model.Username;
import com.secretsanta.domain.port.RefreshTokenRepository;
import com.secretsanta.domain.port.SecretSantaGroupRepository;
import com.secretsanta.domain.port.UserAccountRepository;
import com.secretsanta.domain.service.DerangementDrawService;
import com.secretsanta.domain.service.HouseholdClusterService;
import com.secretsanta.infrastructure.persistence.RefreshTokenDocument;
import com.secretsanta.infrastructure.persistence.SecretSantaGroupDocument;
import com.secretsanta.infrastructure.persistence.SecretSantaIndexesChangeUnit;
import com.secretsanta.infrastructure.persistence.UserAccountDocument;
import java.lang.reflect.RecordComponent;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ContextConfiguration;

@SpringBootTest
@ContextConfiguration(initializers = MongoTestContainerConfig.class)
class SecretSantaApplicationServiceIT {

    @Autowired
    private SecretSantaApplicationService applicationService;

    @Autowired
    private StatelessSessionTokenService tokenService;

    @Autowired
    private UserAccountRepository userAccountRepository;

    @Autowired
    private SecretSantaGroupRepository groupRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private SecretSantaIndexesChangeUnit indexesChangeUnit;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(UserAccountDocument.class);
        mongoTemplate.dropCollection(SecretSantaGroupDocument.class);
        mongoTemplate.dropCollection(RefreshTokenDocument.class);
        indexesChangeUnit.ensureIndexes();
    }

    private static String extractSig(AdminGroupView group) {
        String sharePath = group.sharePath();
        int idx = sharePath.indexOf("?sig=");
        assertThat(idx).isGreaterThan(0);
        return sharePath.substring(idx + 5);
    }

    @Test
    void shouldIssueAndValidateStatelessHmacTokenAndRejectTamperedExpiredOrMissingTokens() {
        UUID userId = UUID.randomUUID();
        Instant issuedAt = Instant.parse("2026-11-13T18:00:00Z");

        String token = tokenService.issueToken(userId, "tiago.godoy", issuedAt);

        AuthenticatedUser parsedFromRaw = tokenService.parseAndValidate(token, issuedAt.plusSeconds(60));
        assertThat(parsedFromRaw.userId()).isEqualTo(userId);
        assertThat(parsedFromRaw.username()).isEqualTo("tiago.godoy");

        AuthenticatedUser parsedFromBearer = tokenService.parseAndValidate(
                "Bearer " + token,
                issuedAt.plusSeconds(60));
        assertThat(parsedFromBearer.userId()).isEqualTo(userId);
        assertThat(parsedFromBearer.username()).isEqualTo("tiago.godoy");

        // Expired token
        assertThatThrownBy(() -> tokenService.parseAndValidate(token, issuedAt.plus(Duration.ofHours(73))))
                .isInstanceOf(InvalidCredentialsException.class);

        // Tampered signature
        assertThatThrownBy(() -> tokenService.parseAndValidate(token + "tamper", issuedAt))
                .isInstanceOf(InvalidCredentialsException.class);

        // Missing or blank token
        assertThatThrownBy(() -> tokenService.parseAndValidate(null, issuedAt))
                .isInstanceOf(InvalidCredentialsException.class);
        assertThatThrownBy(() -> tokenService.parseAndValidate("Bearer   ", issuedAt))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void shouldRegisterAndAuthenticateUserWithBcryptAndRejectDuplicateUsernameOrInvalidPin() {
        AuthSessionView registered = applicationService.registerUser("Tiago Godoy", "  Tiago.Godoy ", "Ab1!cd");

        assertThat(registered.userId()).isNotNull();
        assertThat(registered.name()).isEqualTo("Tiago Godoy");
        assertThat(registered.username()).isEqualTo("tiago.godoy");
        assertThat(registered.token()).isNotBlank();

        UserAccount persisted = userAccountRepository.findByUsername(new Username("tiago.godoy")).orElseThrow();
        assertThat(persisted.pinHash().value()).startsWith("$2");
        assertThat(persisted.pinHash().value()).doesNotContain("Ab1!cd");

        // Duplicate username (case-insensitive)
        assertThatThrownBy(() -> applicationService.registerUser("Outro Tiago", "TIAGO.GODOY", "Cd2@ef"))
                .isInstanceOf(DuplicateUsernameException.class);

        // Valid login
        AuthSessionView loggedIn = applicationService.loginUser("TIAGO.GODOY", "Ab1!cd");
        assertThat(loggedIn.userId()).isEqualTo(registered.userId());
        assertThat(loggedIn.username()).isEqualTo("tiago.godoy");
        assertThat(tokenService.parseAndValidate(loggedIn.token()).userId()).isEqualTo(registered.userId());

        // Wrong PIN or unknown username
        assertThatThrownBy(() -> applicationService.loginUser("tiago.godoy", "Xy9!zw"))
                .isInstanceOf(InvalidCredentialsException.class);
        assertThatThrownBy(() -> applicationService.loginUser("nao.existe", "Ab1!cd"))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void shouldListOnlyMyGroupsWhereUserIsOrganizerOrParticipant() {
        AuthSessionView alice = applicationService.registerUser("Alice", "alice", "Ab1!cd");
        AuthSessionView bob = applicationService.registerUser("Bob", "bob", "Ab1!cd");
        AuthSessionView carol = applicationService.registerUser("Carol", "carol", "Ab1!cd");
        AuthSessionView dave = applicationService.registerUser("Dave", "dave", "Ab1!cd");

        // Group 1: Alice is organizer and participant (no inviteSignature needed for organizer)
        AdminGroupView group1 = applicationService.createGroup(alice.userId(), "Natal Família Alice");
        applicationService.registerParticipant(group1.id(), alice.userId(), null, -23.42, -51.93);

        // Group 2: Bob is organizer, Alice joined as participant using inviteSignature
        AdminGroupView group2 = applicationService.createGroup(bob.userId(), "Amigo Chocolate Bob");
        applicationService.registerParticipant(group2.id(), alice.userId(), extractSig(group2), null, null);

        // Group 3: Bob is organizer, status OPEN, Alice has NOT joined
        applicationService.createGroup(bob.userId(), "Confraternização Privada");

        // Group 4: Bob is organizer, status DRAWN, Alice is NOT participant
        AdminGroupView group4 = applicationService.createGroup(bob.userId(), "Grupo Já Sorteado");
        String sig4 = extractSig(group4);
        applicationService.registerParticipant(group4.id(), bob.userId(), null, null, null);
        applicationService.registerParticipant(group4.id(), carol.userId(), sig4, null, null);
        applicationService.registerParticipant(group4.id(), dave.userId(), sig4, null, null);
        applicationService.executeDraw(group4.id(), bob.userId());

        GroupDiscoveryView discoveryForAlice = applicationService.listGroupsForUser(alice.userId());

        assertThat(discoveryForAlice.myGroups())
                .extracting(SecretSantaApplicationService.GroupSummaryView::id)
                .containsExactlyInAnyOrder(group1.id(), group2.id());
    }

    @Test
    void shouldEnforceOrganizerPermissionOnAdminOperations() {
        AuthSessionView organizer = applicationService.registerUser("Organizador", "org.user", "Ab1!cd");
        AuthSessionView intruder = applicationService.registerUser("Intruso", "intruder.user", "Ab1!cd");

        AdminGroupView group = applicationService.createGroup(organizer.userId(), "Natal Protegido");
        ParticipantRegistrationView joined = applicationService.registerParticipant(
                group.id(), intruder.userId(), extractSig(group), null, null);

        assertThatThrownBy(() -> applicationService.getAdminGroup(group.id(), intruder.userId()))
                .isInstanceOf(UnauthorizedOrganizerAccessException.class);

        assertThatThrownBy(() -> applicationService.rotateInviteSignature(group.id(), intruder.userId()))
                .isInstanceOf(UnauthorizedOrganizerAccessException.class);

        assertThatThrownBy(() -> applicationService.removeParticipant(group.id(), intruder.userId(), joined.id()))
                .isInstanceOf(UnauthorizedOrganizerAccessException.class);

        assertThatThrownBy(() -> applicationService.executeDraw(group.id(), intruder.userId()))
                .isInstanceOf(UnauthorizedOrganizerAccessException.class);

        assertThatThrownBy(() -> applicationService.generatePasswordResetToken(
                        group.id(), intruder.userId(), joined.id()))
                .isInstanceOf(UnauthorizedOrganizerAccessException.class);

        assertThatThrownBy(() -> applicationService.getAdminGroup(group.id(), null))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void shouldRetryParticipantRegistrationOnOptimisticLockingFailureAndSucceed() {
        AuthSessionView organizer = applicationService.registerUser("Org", "org.retry", "Ab1!cd");
        AuthSessionView member = applicationService.registerUser("Membro", "membro.retry", "Ab1!cd");
        AdminGroupView group = applicationService.createGroup(organizer.userId(), "Grupo Retry Otimista");
        String sig = extractSig(group);

        AtomicInteger saveAttempts = new AtomicInteger(0);
        SecretSantaGroupRepository flakyGroupRepository = new SecretSantaGroupRepository() {
            @Override
            public SecretSantaGroup save(SecretSantaGroup g) {
                if (saveAttempts.incrementAndGet() < 3) {
                    throw new OptimisticLockingFailureException("Simulated concurrent modification on @Version");
                }
                return groupRepository.save(g);
            }

            @Override
            public Optional<SecretSantaGroup> findById(UUID id) {
                return groupRepository.findById(id);
            }

            @Override
            public List<SecretSantaGroup> findByUserParticipationOrOrganizationOrderByCreatedAtDesc(UUID userId) {
                return groupRepository.findByUserParticipationOrOrganizationOrderByCreatedAtDesc(userId);
            }
        };

        SecretSantaApplicationService serviceWithFlakyRepo = new SecretSantaApplicationService(
                userAccountRepository,
                flakyGroupRepository,
                tokenService,
                new HouseholdClusterService(),
                new DerangementDrawService(),
                new BCryptPasswordEncoder(),
                Clock.systemUTC());

        ParticipantRegistrationView registration = serviceWithFlakyRepo.registerParticipant(
                group.id(), member.userId(), sig, -23.421, -51.933);

        assertThat(saveAttempts.get()).isEqualTo(3);
        assertThat(registration.userId()).isEqualTo(member.userId());
        assertThat(registration.hasGeoLocation()).isTrue();
    }

    @Test
    void shouldRemoveParticipantWhileOpenAndRejectWhenDrawn() {
        AuthSessionView u1 = applicationService.registerUser("U1", "user.one", "Ab1!cd");
        AuthSessionView u2 = applicationService.registerUser("U2", "user.two", "Ab1!cd");
        AuthSessionView u3 = applicationService.registerUser("U3", "user.three", "Ab1!cd");
        AuthSessionView u4 = applicationService.registerUser("U4", "user.four", "Ab1!cd");

        AdminGroupView group = applicationService.createGroup(u1.userId(), "Natal Exclusão");
        String sig = extractSig(group);
        ParticipantRegistrationView p1 = applicationService.registerParticipant(group.id(), u1.userId(), null, null, null);
        ParticipantRegistrationView p2 = applicationService.registerParticipant(group.id(), u2.userId(), sig, null, null);
        ParticipantRegistrationView p3 = applicationService.registerParticipant(group.id(), u3.userId(), sig, null, null);
        ParticipantRegistrationView p4 = applicationService.registerParticipant(group.id(), u4.userId(), sig, null, null);

        // Remove p4 while OPEN
        applicationService.removeParticipant(group.id(), u1.userId(), p4.id());
        AdminGroupView afterRemoval = applicationService.getAdminGroup(group.id(), u1.userId());
        assertThat(afterRemoval.participants()).hasSize(3);

        // Execute draw
        applicationService.executeDraw(group.id(), u1.userId());

        // Attempt to remove p1 after draw must throw GroupAlreadyDrawnException
        assertThatThrownBy(() -> applicationService.removeParticipant(group.id(), u1.userId(), p1.id()))
                .isInstanceOf(GroupAlreadyDrawnException.class);
        assertThat(p2.id()).isNotEqualTo(p3.id());
    }

    @Test
    void shouldExecuteDrawRevealMatchWithPinAndMarkRevealedStatus() {
        AuthSessionView ana = applicationService.registerUser("Ana", "ana", "Aa1!bb");
        AuthSessionView bia = applicationService.registerUser("Bia", "bia", "Bb2@cc");
        AuthSessionView caio = applicationService.registerUser("Caio", "caio", "Cc3#dd");

        AdminGroupView group = applicationService.createGroup(ana.userId(), "Natal Revelação");
        String sig = extractSig(group);
        applicationService.registerParticipant(group.id(), ana.userId(), null, -23.4200, -51.9300);
        applicationService.registerParticipant(group.id(), bia.userId(), sig, -23.4500, -51.9500);
        applicationService.registerParticipant(group.id(), caio.userId(), sig, -23.4800, -51.9800);

        // Reveal while OPEN must fail with GroupNotDrawnYetException
        assertThatThrownBy(() -> applicationService.revealMatch(group.id(), "ana", "Aa1!bb"))
                .isInstanceOf(GroupNotDrawnYetException.class);

        AdminGroupView drawnGroup = applicationService.executeDraw(group.id(), ana.userId());
        assertThat(drawnGroup.status()).isEqualTo(GroupStatus.DRAWN);
        assertThat(drawnGroup.geographicRestrictionRelaxed()).isFalse();
        assertThat(drawnGroup.participants())
                .allSatisfy(p -> assertThat(p.revealStatus()).isEqualTo(RevealStatus.PENDING_REVEAL));

        // Wrong PIN or non-participant username must fail with InvalidCredentialsException
        assertThatThrownBy(() -> applicationService.revealMatch(group.id(), "ana", "Xy9!zw"))
                .isInstanceOf(InvalidCredentialsException.class);
        assertThatThrownBy(() -> applicationService.revealMatch(group.id(), "desconhecido", "Aa1!bb"))
                .isInstanceOf(InvalidCredentialsException.class);

        // Valid reveal
        RevealMatchView reveal = applicationService.revealMatch(group.id(), "ANA", "Aa1!bb");
        assertThat(reveal.username()).isEqualTo("ana");
        assertThat(reveal.drawnParticipantName()).isIn("Bia", "Caio");
        assertThat(reveal.revealedAt()).isNotNull();

        PublicGroupView publicAfterReveal = applicationService.getPublicGroup(group.id(), ana.userId());
        assertThat(publicAfterReveal.participantsVisible()).isTrue();
        assertThat(publicAfterReveal.inviteValid()).isTrue();
        assertThat(publicAfterReveal.participants())
                .filteredOn(p -> p.username().equals("ana"))
                .singleElement()
                .satisfies(p -> assertThat(p.revealStatus()).isEqualTo(RevealStatus.REVEALED));
    }

    @Test
    void shouldGenerateOneTimePasswordResetLinkAndUpdatePinInvalidatingTokenImmediately() {
        Instant baseTime = Instant.parse("2026-11-13T18:00:00Z");
        SecretSantaApplicationService timeControlledService = new SecretSantaApplicationService(
                userAccountRepository,
                groupRepository,
                tokenService,
                new HouseholdClusterService(),
                new DerangementDrawService(),
                new BCryptPasswordEncoder(),
                Clock.fixed(baseTime, ZoneOffset.UTC));

        AuthSessionView org = timeControlledService.registerUser("Organizador", "org.reset", "Ab1!cd");
        AuthSessionView lucas = timeControlledService.registerUser("Lucas", "lucas.silva", "Aa1!bb");

        AdminGroupView group = timeControlledService.createGroup(org.userId(), "Natal Reset PIN");
        ParticipantRegistrationView lucasParticipant = timeControlledService.registerParticipant(
                group.id(), lucas.userId(), extractSig(group), null, null);

        PasswordResetLinkView resetLink = timeControlledService.generatePasswordResetToken(
                group.id(), org.userId(), lucasParticipant.id());

        assertThat(resetLink.resetToken()).isNotBlank();
        assertThat(resetLink.resetPath()).isEqualTo("/reset/" + resetLink.resetToken());
        assertThat(resetLink.expiresAt()).isEqualTo(baseTime.plus(Duration.ofHours(24)));

        // Consume one-time token to set new PIN
        timeControlledService.resetPinWithToken(resetLink.resetToken(), "Zz9!yy");

        // Second use of the same token must fail immediately
        assertThatThrownBy(() -> timeControlledService.resetPinWithToken(resetLink.resetToken(), "Ww8@vv"))
                .isInstanceOf(InvalidPasswordResetTokenException.class);

        // Old PIN no longer works; new PIN works
        assertThatThrownBy(() -> timeControlledService.loginUser("lucas.silva", "Aa1!bb"))
                .isInstanceOf(InvalidCredentialsException.class);
        AuthSessionView relogin = timeControlledService.loginUser("lucas.silva", "Zz9!yy");
        assertThat(relogin.userId()).isEqualTo(lucas.userId());
    }

    @Test
    void shouldNeverExposeDrawnParticipantIdPinHashResetTokenHashOrInviteSignatureInPublicView() throws Exception {
        Set<String> forbiddenFields = Set.of(
                "drawnParticipantId", "pinHash", "groupPinHash", "resetTokenHash", "inviteSignature");
        List<Class<?>> dtoClasses = List.of(
                AuthSessionView.class,
                SecretSantaApplicationService.GroupSummaryView.class,
                GroupDiscoveryView.class,
                SecretSantaApplicationService.AdminParticipantView.class,
                AdminGroupView.class,
                SecretSantaApplicationService.PublicParticipantView.class,
                PublicGroupView.class,
                ParticipantRegistrationView.class,
                PasswordResetLinkView.class,
                SecretSantaApplicationService.PinResetResultView.class,
                RevealMatchView.class);

        for (Class<?> dtoClass : dtoClasses) {
            List<String> componentNames = Arrays.stream(dtoClass.getRecordComponents())
                    .map(RecordComponent::getName)
                    .toList();
            assertThat(componentNames)
                    .as("DTO %s must never expose forbidden secret fields", dtoClass.getSimpleName())
                    .doesNotContainAnyElementsOf(forbiddenFields);
        }

        AuthSessionView u1 = applicationService.registerUser("P1", "p1.sec", "Ab1!cd");
        AuthSessionView u2 = applicationService.registerUser("P2", "p2.sec", "Ee5%ff");
        AuthSessionView u3 = applicationService.registerUser("P3", "p3.sec", "Ff6^gg");

        AdminGroupView group = applicationService.createGroup(u1.userId(), "Grupo Sigilo");
        String sig = extractSig(group);
        applicationService.registerParticipant(group.id(), u1.userId(), null, null, null);
        applicationService.registerParticipant(group.id(), u2.userId(), sig, null, null);
        applicationService.registerParticipant(group.id(), u3.userId(), sig, null, null);

        AdminGroupView drawnAdminView = applicationService.executeDraw(group.id(), u1.userId());
        PublicGroupView drawnPublicView = applicationService.getPublicGroup(group.id(), u1.userId());

        String adminJson = objectMapper.writeValueAsString(drawnAdminView);
        String publicJson = objectMapper.writeValueAsString(drawnPublicView);

        assertThat(adminJson).doesNotContain("drawnParticipantId", "pinHash", "groupPinHash", "resetTokenHash");
        assertThat(publicJson).doesNotContain(
                "drawnParticipantId", "pinHash", "groupPinHash", "resetTokenHash", "inviteSignature", sig);
    }

    @Test
    void shouldSupportDirectVisitorRegistrationWithValidInviteSignatureAndAvoidOrphanUserOnInvalidSignature() {
        AuthSessionView org = applicationService.registerUser("Organizador", "org.whats", "Ab1!cd");
        AdminGroupView group = applicationService.createGroup(org.userId(), "Grupo Link WhatsApp");
        String sig = extractSig(group);

        // Wrong or missing inviteSignature must fail BEFORE creating user account
        assertThatThrownBy(() -> applicationService.registerVisitorAndJoinGroup(
                        group.id(),
                        "Orphan User",
                        "orphan.user",
                        "Dd4$ee",
                        "invalid_signature_1234567890",
                        -23.42,
                        -51.93))
                .isInstanceOf(InvalidInviteSignatureException.class);

        assertThat(userAccountRepository.findByUsername(new Username("orphan.user"))).isEmpty();

        var joinResult = applicationService.registerVisitorAndJoinGroupWithTokens(
                group.id(),
                "Tia Maria",
                "tia.maria",
                "Dd4$ee",
                sig,
                -23.42,
                -51.93);
        ParticipantRegistrationView joinedVisitor = joinResult.participant();

        assertThat(joinedVisitor.name()).isEqualTo("Tia Maria");
        assertThat(joinedVisitor.username()).isEqualTo("tia.maria");
        assertThat(joinedVisitor.hasGeoLocation()).isTrue();
        assertThat(joinResult.accessToken()).isNotBlank();
        assertThat(joinResult.refreshToken()).isNotBlank();

        // Trying to join the same group again must fail with DuplicateParticipantException
        assertThatThrownBy(() -> applicationService.registerParticipant(
                        group.id(), joinedVisitor.userId(), sig, null, null))
                .isInstanceOf(DuplicateParticipantException.class);
    }

    @Test
    void shouldRotateInviteSignatureInvalidatingPreviousLinkImmediately() {
        AuthSessionView org = applicationService.registerUser("Organizador", "org.rot", "Ab1!cd");
        AuthSessionView guest = applicationService.registerUser("Convidado", "guest.rot", "Ab1!cd");

        AdminGroupView created = applicationService.createGroup(org.userId(), "Grupo Rotação");
        String oldSig = extractSig(created);

        assertThat(applicationService.getPublicGroup(created.id(), null, oldSig).inviteValid()).isTrue();

        AdminGroupView rotated = applicationService.rotateInviteSignature(created.id(), org.userId());
        String newSig = extractSig(rotated);
        assertThat(newSig).isNotEqualTo(oldSig);

        assertThat(applicationService.getPublicGroup(created.id(), null, oldSig).inviteValid()).isFalse();
        assertThat(applicationService.getPublicGroup(created.id(), null, newSig).inviteValid()).isTrue();

        assertThatThrownBy(() -> applicationService.registerParticipant(
                        created.id(), guest.userId(), oldSig, null, null))
                .isInstanceOf(InvalidInviteSignatureException.class);

        ParticipantRegistrationView joined = applicationService.registerParticipant(
                created.id(), guest.userId(), newSig, null, null);
        assertThat(joined.userId()).isEqualTo(guest.userId());
    }

    @Test
    void shouldRotateRefreshTokensDetectReuseRevokeOnLogoutAndSupportLegacyPinHashes() {
        AuthSessionResult registered = applicationService.registerUserWithTokens("Ana Paula", "ana.paula", "Ab1!cd");
        assertThat(registered.accessToken()).isNotBlank();
        assertThat(registered.refreshToken()).isNotBlank();

        // Rotate refresh token
        AuthSessionResult rotated = applicationService.refreshSession(registered.refreshToken());
        assertThat(rotated.userId()).isEqualTo(registered.userId());
        assertThat(rotated.refreshToken()).isNotEqualTo(registered.refreshToken());

        // Reusing old revoked refresh token must revoke entire family and fail
        assertThatThrownBy(() -> applicationService.refreshSession(registered.refreshToken()))
                .isInstanceOf(InvalidCredentialsException.class);
        assertThatThrownBy(() -> applicationService.refreshSession(rotated.refreshToken()))
                .isInstanceOf(InvalidCredentialsException.class);

        // New login + logout revokes refresh token
        AuthSessionResult relogin = applicationService.loginUserWithTokens("ana.paula", "Ab1!cd");
        applicationService.logoutSession(relogin.refreshToken());
        assertThatThrownBy(() -> applicationService.refreshSession(relogin.refreshToken()))
                .isInstanceOf(InvalidCredentialsException.class);

        // Legacy 4-digit numeric PIN hash stored in MongoDB still works for login & reveal
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        UserAccount legacyUser = UserAccount.register(
                new ParticipantName("Vovó Maria"),
                new Username("vovo.maria"),
                new PinHash(encoder.encode("1950")),
                Instant.now());
        userAccountRepository.save(legacyUser);
        AuthSessionResult legacySession = applicationService.loginUserWithTokens("vovo.maria", "1950");
        assertThat(legacySession.userId()).isEqualTo(legacyUser.id());
    }

    @Test
    void shouldThrowAlreadyParticipantAuthenticatedExceptionWithTokensEvenAfterInviteRotation() {
        AuthSessionView org = applicationService.registerUser("Organizador", "org.rejoin", "Ab1!cd");
        AuthSessionView member = applicationService.registerUser("Membro", "membro.rejoin", "Bb2@cc");
        AdminGroupView group = applicationService.createGroup(org.userId(), "Grupo Rejoin");
        String initialSig = extractSig(group);
        applicationService.registerParticipant(group.id(), member.userId(), initialSig, null, null);

        // Rotate invite link
        applicationService.rotateInviteSignature(group.id(), org.userId());

        // Already-joined user logs in via visitor flow with old/missing sig -> throws AlreadyParticipantAuthenticatedException with valid tokens
        assertThatThrownBy(() -> applicationService.registerVisitorAndJoinGroupWithTokens(
                        group.id(), null, "membro.rejoin", "Bb2@cc", initialSig, null, null))
                .isInstanceOfSatisfying(AlreadyParticipantAuthenticatedException.class, ex -> {
                    assertThat(ex.userId()).isEqualTo(member.userId());
                    assertThat(ex.groupId()).isEqualTo(group.id());
                    assertThat(ex.accessToken()).isNotBlank();
                    assertThat(ex.refreshToken()).isNotBlank();
                    assertThat(tokenService.parseAndValidate(ex.accessToken()).userId()).isEqualTo(member.userId());
                });
    }
}
