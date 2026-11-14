package com.secretsanta.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.secretsanta.application.SecretSantaApplicationService.AdminGroupView;
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
import com.secretsanta.domain.exception.InvalidPasswordResetTokenException;
import com.secretsanta.domain.exception.UnauthorizedOrganizerAccessException;
import com.secretsanta.domain.model.GroupSlug;
import com.secretsanta.domain.model.GroupStatus;
import com.secretsanta.domain.model.RevealStatus;
import com.secretsanta.domain.model.SecretSantaGroup;
import com.secretsanta.domain.model.UserAccount;
import com.secretsanta.domain.model.Username;
import com.secretsanta.domain.port.SecretSantaGroupRepository;
import com.secretsanta.domain.port.UserAccountRepository;
import com.secretsanta.domain.service.DerangementDrawService;
import com.secretsanta.domain.service.HouseholdClusterService;
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
    private MongoTemplate mongoTemplate;

    @Autowired
    private SecretSantaIndexesChangeUnit indexesChangeUnit;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(UserAccountDocument.class);
        mongoTemplate.dropCollection(SecretSantaGroupDocument.class);
        indexesChangeUnit.ensureIndexes();
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
        AuthSessionView registered = applicationService.registerUser("Tiago Godoy", "  Tiago.Godoy ", "1234");

        assertThat(registered.userId()).isNotNull();
        assertThat(registered.name()).isEqualTo("Tiago Godoy");
        assertThat(registered.username()).isEqualTo("tiago.godoy");
        assertThat(registered.token()).isNotBlank();

        UserAccount persisted = userAccountRepository.findByUsername(new Username("tiago.godoy")).orElseThrow();
        assertThat(persisted.pinHash().value()).startsWith("$2");
        assertThat(persisted.pinHash().value()).doesNotContain("1234");

        // Duplicate username (case-insensitive)
        assertThatThrownBy(() -> applicationService.registerUser("Outro Tiago", "TIAGO.GODOY", "5678"))
                .isInstanceOf(DuplicateUsernameException.class);

        // Valid login
        AuthSessionView loggedIn = applicationService.loginUser("TIAGO.GODOY", "1234");
        assertThat(loggedIn.userId()).isEqualTo(registered.userId());
        assertThat(loggedIn.username()).isEqualTo("tiago.godoy");
        assertThat(tokenService.parseAndValidate(loggedIn.token()).userId()).isEqualTo(registered.userId());

        // Wrong PIN or unknown username
        assertThatThrownBy(() -> applicationService.loginUser("tiago.godoy", "9999"))
                .isInstanceOf(InvalidCredentialsException.class);
        assertThatThrownBy(() -> applicationService.loginUser("nao.existe", "1234"))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void shouldSeparateMyGroupsAndAvailableOpenGroupsForUser() {
        AuthSessionView alice = applicationService.registerUser("Alice", "alice", "1234");
        AuthSessionView bob = applicationService.registerUser("Bob", "bob", "1234");
        AuthSessionView carol = applicationService.registerUser("Carol", "carol", "1234");
        AuthSessionView dave = applicationService.registerUser("Dave", "dave", "1234");

        // Group 1: Alice is organizer and participant
        AdminGroupView group1 = applicationService.createGroup(alice.userId(), "Natal Família Alice");
        applicationService.registerParticipant(group1.slug(), alice.userId(), -23.42, -51.93);

        // Group 2: Bob is organizer, Alice joined as participant
        AdminGroupView group2 = applicationService.createGroup(bob.userId(), "Amigo Chocolate Bob");
        applicationService.registerParticipant(group2.slug(), alice.userId(), null, null);

        // Group 3: Bob is organizer, status OPEN, Alice has NOT joined
        AdminGroupView group3 = applicationService.createGroup(bob.userId(), "Confraternização Aberta");

        // Group 4: Bob is organizer, status DRAWN, Alice is NOT participant
        AdminGroupView group4 = applicationService.createGroup(bob.userId(), "Grupo Já Sorteado");
        applicationService.registerParticipant(group4.slug(), bob.userId(), null, null);
        applicationService.registerParticipant(group4.slug(), carol.userId(), null, null);
        applicationService.registerParticipant(group4.slug(), dave.userId(), null, null);
        applicationService.executeDraw(group4.slug(), bob.userId());

        GroupDiscoveryView discoveryForAlice = applicationService.listGroupsForUser(alice.userId());

        assertThat(discoveryForAlice.myGroups())
                .extracting( SecretSantaApplicationService.GroupSummaryView::slug)
                .containsExactlyInAnyOrder(group1.slug(), group2.slug());

        assertThat(discoveryForAlice.availableGroups())
                .extracting(SecretSantaApplicationService.GroupSummaryView::slug)
                .containsExactly(group3.slug());
    }

    @Test
    void shouldEnforceOrganizerPermissionOnAdminOperations() {
        AuthSessionView organizer = applicationService.registerUser("Organizador", "org.user", "1234");
        AuthSessionView intruder = applicationService.registerUser("Intruso", "intruder.user", "1234");

        AdminGroupView group = applicationService.createGroup(organizer.userId(), "Natal Protegido");
        ParticipantRegistrationView joined = applicationService.registerParticipant(
                group.slug(), intruder.userId(), null, null);

        assertThatThrownBy(() -> applicationService.getAdminGroup(group.slug(), intruder.userId()))
                .isInstanceOf(UnauthorizedOrganizerAccessException.class);

        assertThatThrownBy(() -> applicationService.removeParticipant(group.slug(), intruder.userId(), joined.id()))
                .isInstanceOf(UnauthorizedOrganizerAccessException.class);

        assertThatThrownBy(() -> applicationService.executeDraw(group.slug(), intruder.userId()))
                .isInstanceOf(UnauthorizedOrganizerAccessException.class);

        assertThatThrownBy(() -> applicationService.generatePasswordResetToken(
                        group.slug(), intruder.userId(), joined.id()))
                .isInstanceOf(UnauthorizedOrganizerAccessException.class);

        assertThatThrownBy(() -> applicationService.getAdminGroup(group.slug(), null))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void shouldRetryParticipantRegistrationOnOptimisticLockingFailureAndSucceed() {
        AuthSessionView organizer = applicationService.registerUser("Org", "org.retry", "1234");
        AuthSessionView member = applicationService.registerUser("Membro", "membro.retry", "1234");
        AdminGroupView group = applicationService.createGroup(organizer.userId(), "Grupo Retry Otimista");

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
            public Optional<SecretSantaGroup> findByPublicSlug(GroupSlug publicSlug) {
                return groupRepository.findByPublicSlug(publicSlug);
            }

            @Override
            public boolean existsByPublicSlug(GroupSlug publicSlug) {
                return groupRepository.existsByPublicSlug(publicSlug);
            }

            @Override
            public List<SecretSantaGroup> findAllOrderByCreatedAtDesc() {
                return groupRepository.findAllOrderByCreatedAtDesc();
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
                group.slug(), member.userId(), -23.421, -51.933);

        assertThat(saveAttempts.get()).isEqualTo(3);
        assertThat(registration.userId()).isEqualTo(member.userId());
        assertThat(registration.hasGeoLocation()).isTrue();
    }

    @Test
    void shouldRemoveParticipantWhileOpenAndRejectWhenDrawn() {
        AuthSessionView u1 = applicationService.registerUser("U1", "user.one", "1234");
        AuthSessionView u2 = applicationService.registerUser("U2", "user.two", "1234");
        AuthSessionView u3 = applicationService.registerUser("U3", "user.three", "1234");
        AuthSessionView u4 = applicationService.registerUser("U4", "user.four", "1234");

        AdminGroupView group = applicationService.createGroup(u1.userId(), "Natal Exclusão");
        ParticipantRegistrationView p1 = applicationService.registerParticipant(group.slug(), u1.userId(), null, null);
        ParticipantRegistrationView p2 = applicationService.registerParticipant(group.slug(), u2.userId(), null, null);
        ParticipantRegistrationView p3 = applicationService.registerParticipant(group.slug(), u3.userId(), null, null);
        ParticipantRegistrationView p4 = applicationService.registerParticipant(group.slug(), u4.userId(), null, null);

        // Remove p4 while OPEN
        applicationService.removeParticipant(group.slug(), u1.userId(), p4.id());
        AdminGroupView afterRemoval = applicationService.getAdminGroup(group.slug(), u1.userId());
        assertThat(afterRemoval.participants()).hasSize(3);

        // Execute draw
        applicationService.executeDraw(group.slug(), u1.userId());

        // Attempt to remove p1 after draw must throw GroupAlreadyDrawnException
        assertThatThrownBy(() -> applicationService.removeParticipant(group.slug(), u1.userId(), p1.id()))
                .isInstanceOf(GroupAlreadyDrawnException.class);
        assertThat(p2.id()).isNotEqualTo(p3.id());
    }

    @Test
    void shouldExecuteDrawRevealMatchWithPinAndMarkRevealedStatus() {
        AuthSessionView ana = applicationService.registerUser("Ana", "ana", "1111");
        AuthSessionView bia = applicationService.registerUser("Bia", "bia", "2222");
        AuthSessionView caio = applicationService.registerUser("Caio", "caio", "3333");

        AdminGroupView group = applicationService.createGroup(ana.userId(), "Natal Revelação");
        applicationService.registerParticipant(group.slug(), ana.userId(), -23.4200, -51.9300);
        applicationService.registerParticipant(group.slug(), bia.userId(), -23.4500, -51.9500);
        applicationService.registerParticipant(group.slug(), caio.userId(), -23.4800, -51.9800);

        // Reveal while OPEN must fail with GroupNotDrawnYetException
        assertThatThrownBy(() -> applicationService.revealMatch(group.slug(), "ana", "1111"))
                .isInstanceOf(GroupNotDrawnYetException.class);

        AdminGroupView drawnGroup = applicationService.executeDraw(group.slug(), ana.userId());
        assertThat(drawnGroup.status()).isEqualTo(GroupStatus.DRAWN);
        assertThat(drawnGroup.geographicRestrictionRelaxed()).isFalse();
        assertThat(drawnGroup.participants())
                .allSatisfy(p -> assertThat(p.revealStatus()).isEqualTo(RevealStatus.PENDING_REVEAL));

        // Wrong PIN or non-participant username must fail with InvalidCredentialsException
        assertThatThrownBy(() -> applicationService.revealMatch(group.slug(), "ana", "9999"))
                .isInstanceOf(InvalidCredentialsException.class);
        assertThatThrownBy(() -> applicationService.revealMatch(group.slug(), "desconhecido", "1111"))
                .isInstanceOf(InvalidCredentialsException.class);

        // Valid reveal
        RevealMatchView reveal = applicationService.revealMatch(group.slug(), "ANA", "1111");
        assertThat(reveal.username()).isEqualTo("ana");
        assertThat(reveal.drawnParticipantName()).isIn("Bia", "Caio");
        assertThat(reveal.revealedAt()).isNotNull();

        PublicGroupView publicAfterReveal = applicationService.getPublicGroup(group.slug(), ana.userId());
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

        AuthSessionView org = timeControlledService.registerUser("Organizador", "org.reset", "1234");
        AuthSessionView lucas = timeControlledService.registerUser("Lucas", "lucas.silva", "1111");

        AdminGroupView group = timeControlledService.createGroup(org.userId(), "Natal Reset PIN");
        ParticipantRegistrationView lucasParticipant = timeControlledService.registerParticipant(
                group.slug(), lucas.userId(), null, null);

        PasswordResetLinkView resetLink = timeControlledService.generatePasswordResetToken(
                group.slug(), org.userId(), lucasParticipant.id());

        assertThat(resetLink.resetToken()).isNotBlank();
        assertThat(resetLink.resetPath()).isEqualTo("/reset/" + resetLink.resetToken());
        assertThat(resetLink.expiresAt()).isEqualTo(baseTime.plus(Duration.ofHours(24)));

        // Consume one-time token to set new PIN
        timeControlledService.resetPinWithToken(resetLink.resetToken(), "654321");

        // Second use of the same token must fail immediately
        assertThatThrownBy(() -> timeControlledService.resetPinWithToken(resetLink.resetToken(), "1122"))
                .isInstanceOf(InvalidPasswordResetTokenException.class);

        // Old PIN no longer works; new PIN works
        assertThatThrownBy(() -> timeControlledService.loginUser("lucas.silva", "1111"))
                .isInstanceOf(InvalidCredentialsException.class);
        AuthSessionView relogin = timeControlledService.loginUser("lucas.silva", "654321");
        assertThat(relogin.userId()).isEqualTo(lucas.userId());
    }

    @Test
    void shouldNeverExposeDrawnParticipantIdPinHashOrResetTokenHashInAnyViewDto() throws Exception {
        Set<String> forbiddenFields = Set.of("drawnParticipantId", "pinHash", "resetTokenHash");
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

        AuthSessionView u1 = applicationService.registerUser("P1", "p1.sec", "1234");
        AuthSessionView u2 = applicationService.registerUser("P2", "p2.sec", "2345");
        AuthSessionView u3 = applicationService.registerUser("P3", "p3.sec", "3456");

        AdminGroupView group = applicationService.createGroup(u1.userId(), "Grupo Sigilo");
        applicationService.registerParticipant(group.slug(), u1.userId(), null, null);
        applicationService.registerParticipant(group.slug(), u2.userId(), null, null);
        applicationService.registerParticipant(group.slug(), u3.userId(), null, null);

        AdminGroupView drawnAdminView = applicationService.executeDraw(group.slug(), u1.userId());
        PublicGroupView drawnPublicView = applicationService.getPublicGroup(group.slug(), u1.userId());

        String adminJson = objectMapper.writeValueAsString(drawnAdminView);
        String publicJson = objectMapper.writeValueAsString(drawnPublicView);

        assertThat(adminJson).doesNotContain("drawnParticipantId", "pinHash", "resetTokenHash");
        assertThat(publicJson).doesNotContain("drawnParticipantId", "pinHash", "resetTokenHash");
    }

    @Test
    void shouldSupportDirectVisitorRegistrationAndGroupJoinInSingleFlow() {
        AuthSessionView org = applicationService.registerUser("Organizador", "org.whats", "1234");
        AdminGroupView group = applicationService.createGroup(org.userId(), "Grupo Link WhatsApp");

        ParticipantRegistrationView joinedVisitor = applicationService.registerVisitorAndJoinGroup(
                group.slug(),
                "Tia Maria",
                "tia.maria",
                "4321",
                -23.42,
                -51.93);

        assertThat(joinedVisitor.name()).isEqualTo("Tia Maria");
        assertThat(joinedVisitor.username()).isEqualTo("tia.maria");
        assertThat(joinedVisitor.hasGeoLocation()).isTrue();
        assertThat(joinedVisitor.token()).isNotBlank();

        // Trying to join the same group again must fail with DuplicateParticipantException
        assertThatThrownBy(() -> applicationService.registerParticipant(
                        group.slug(), joinedVisitor.userId(), null, null))
                .isInstanceOf(DuplicateParticipantException.class);
    }
}
