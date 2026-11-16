package com.secretsanta.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.secretsanta.config.MongoTestContainerConfig;
import com.secretsanta.domain.model.GeoCoordinates;
import com.secretsanta.domain.model.GroupStatus;
import com.secretsanta.domain.model.InviteSignature;
import com.secretsanta.domain.model.Participant;
import com.secretsanta.domain.model.ParticipantName;
import com.secretsanta.domain.model.PasswordResetTokenHash;
import com.secretsanta.domain.model.PinHash;
import com.secretsanta.domain.model.RefreshToken;
import com.secretsanta.domain.model.SecretSantaGroup;
import com.secretsanta.domain.model.UserAccount;
import com.secretsanta.domain.model.Username;
import com.secretsanta.domain.port.RefreshTokenRepository;
import com.secretsanta.domain.port.SecretSantaGroupRepository;
import com.secretsanta.domain.port.UserAccountRepository;
import com.secretsanta.domain.service.DerangementDrawService;
import com.secretsanta.domain.service.HouseholdClusterService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.ContextConfiguration;

@SpringBootTest
@ContextConfiguration(initializers = MongoTestContainerConfig.class)
class MongoPersistenceAdaptersIT {

    private static final Instant NOW = Instant.parse("2026-11-13T18:00:00Z");

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

    @BeforeEach
    void setUp() {
        mongoTemplate.dropCollection(UserAccountDocument.class);
        mongoTemplate.dropCollection(SecretSantaGroupDocument.class);
        mongoTemplate.dropCollection(RefreshTokenDocument.class);
        indexesChangeUnit.ensureIndexes();
    }

    @Test
    void shouldPersistAndReconstituteUserAccountAndLookupByUsernameAndResetTokenHash() {
        UserAccount user = UserAccount.register(
                new ParticipantName("Tiago Godoy"),
                new Username("tiago.godoy"),
                new PinHash("$2a$10$hash1234"),
                NOW);
        PasswordResetTokenHash tokenHash = new PasswordResetTokenHash("sha256-reset-token-abc");
        Instant expiresAt = NOW.plus(24, ChronoUnit.HOURS);
        user.issuePasswordResetToken(tokenHash, expiresAt);

        UserAccount saved = userAccountRepository.save(user);
        assertThat(saved.version()).isNotNull();

        UserAccount byUsername = userAccountRepository.findByUsername(new Username("TIAGO.GODOY")).orElseThrow();
        assertThat(byUsername.id()).isEqualTo(user.id());
        assertThat(byUsername.name().value()).isEqualTo("Tiago Godoy");
        assertThat(byUsername.pinHash().value()).isEqualTo("$2a$10$hash1234");
        assertThat(byUsername.resetTokenHash()).isEqualTo(tokenHash);
        assertThat(byUsername.resetTokenExpiresAt()).isEqualTo(expiresAt);

        UserAccount byResetToken = userAccountRepository.findByResetTokenHash(tokenHash).orElseThrow();
        assertThat(byResetToken.id()).isEqualTo(user.id());
        assertThat(userAccountRepository.existsByUsername(new Username("tiago.godoy"))).isTrue();
    }

    @Test
    void shouldEnforceUniqueUsernameIndexInUsersCollection() {
        UserAccount first = UserAccount.register(
                new ParticipantName("Maria Um"),
                new Username("maria.silva"),
                new PinHash("$2a$10$hash1"),
                NOW);
        userAccountRepository.save(first);

        UserAccount duplicate = UserAccount.register(
                new ParticipantName("Maria Dois"),
                new Username("maria.silva"),
                new PinHash("$2a$10$hash2"),
                NOW);

        assertThatThrownBy(() -> userAccountRepository.save(duplicate))
                .isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    void shouldPersistSecretSantaGroupAsSingleDocumentWithEmbeddedParticipantsAndDrawOutcome() {
        UUID organizerId = UUID.randomUUID();
        SecretSantaGroup group = SecretSantaGroup.create(
                "Natal da Família",
                new InviteSignature("sig_InviteSignatureValueForTest123456"),
                organizerId,
                NOW);

        group.registerParticipant(
                organizerId,
                new ParticipantName("Ana"),
                new Username("ana"),
                new GeoCoordinates(-23.420999, -51.933056),
                NOW);
        group.registerParticipant(
                UUID.randomUUID(),
                new ParticipantName("Bruno"),
                new Username("bruno"),
                new GeoCoordinates(-23.450000, -51.950000),
                NOW);
        group.registerParticipant(
                UUID.randomUUID(),
                new ParticipantName("Carla"),
                new Username("carla"),
                null,
                NOW);

        group.executeDraw(new HouseholdClusterService(), new DerangementDrawService(), NOW.plusSeconds(300));
        Participant ana = group.findParticipantByUsername(new Username("ana"));
        group.markRevealedAndGetDrawnName(ana.id(), NOW.plusSeconds(600));

        SecretSantaGroup saved = groupRepository.save(group);
        assertThat(saved.version()).isNotNull();

        SecretSantaGroup loaded = groupRepository.findById(group.id()).orElseThrow();
        assertThat(loaded.id()).isEqualTo(group.id());
        assertThat(loaded.eventName()).isEqualTo("Natal da Família");
        assertThat(loaded.inviteSignature().value()).isEqualTo("sig_InviteSignatureValueForTest123456");
        assertThat(loaded.organizerUserId()).isEqualTo(organizerId);
        assertThat(loaded.status()).isEqualTo(GroupStatus.DRAWN);
        assertThat(loaded.drawnAt()).isEqualTo(NOW.plusSeconds(300));
        assertThat(loaded.participants()).hasSize(3);

        Participant loadedAna = loaded.findParticipantByUsername(new Username("ana"));
        assertThat(loadedAna.coordinates()).isEqualTo(new GeoCoordinates(-23.420999, -51.933056));
        assertThat(loadedAna.householdClusterId()).isNotNull();
        assertThat(loadedAna.drawnParticipantId()).isNotNull();
        assertThat(loadedAna.revealedAt()).isEqualTo(NOW.plusSeconds(600));
    }

    @Test
    void shouldRejectConcurrentStaleWritesWithOptimisticLockingFailureException() {
        UUID organizerId = UUID.randomUUID();
        SecretSantaGroup created = groupRepository.save(SecretSantaGroup.create(
                "Natal Concorrente",
                new InviteSignature("sig_ConcurrentInviteSignature123456"),
                organizerId,
                NOW));

        SecretSantaGroup copyA = groupRepository.findById(created.id()).orElseThrow();
        SecretSantaGroup copyB = groupRepository.findById(created.id()).orElseThrow();

        copyA.registerParticipant(
                UUID.randomUUID(),
                new ParticipantName("Familiar A"),
                new Username("familiar.a"),
                null,
                NOW);
        groupRepository.save(copyA);

        copyB.registerParticipant(
                UUID.randomUUID(),
                new ParticipantName("Familiar B"),
                new Username("familiar.b"),
                null,
                NOW);

        assertThatThrownBy(() -> groupRepository.save(copyB))
                .isInstanceOf(OptimisticLockingFailureException.class);
    }

    @Test
    void shouldFindOnlyUserOrganizedOrParticipatedGroupsOrderedByCreatedAtDesc() {
        UUID userId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();

        SecretSantaGroup organizedOlder = SecretSantaGroup.create(
                "Grupo Organizado",
                new InviteSignature("sig_OrganizedOlderInviteSig123456"),
                userId,
                NOW);
        SecretSantaGroup participatedNewer = SecretSantaGroup.create(
                "Grupo Participante",
                new InviteSignature("sig_ParticipatedNewerInvite123456"),
                otherUserId,
                NOW.plusSeconds(120));
        participatedNewer.registerParticipant(
                userId,
                new ParticipantName("Convidado"),
                new Username("convidado"),
                null,
                NOW.plusSeconds(130));
        SecretSantaGroup thirdPartyGroup = SecretSantaGroup.create(
                "Grupo Terceiros",
                new InviteSignature("sig_ThirdPartyInviteSig1234567890"),
                otherUserId,
                NOW.plusSeconds(240));

        groupRepository.save(organizedOlder);
        groupRepository.save(participatedNewer);
        groupRepository.save(thirdPartyGroup);

        List<SecretSantaGroup> userGroups = groupRepository
                .findByUserParticipationOrOrganizationOrderByCreatedAtDesc(userId);
        assertThat(userGroups).extracting(SecretSantaGroup::eventName)
                .containsExactly("Grupo Participante", "Grupo Organizado");
    }

    @Test
    void shouldPersistAndRevokeRefreshTokensByFamilyAndUserId() {
        UUID userId = UUID.randomUUID();
        UUID familyA = UUID.randomUUID();
        UUID familyB = UUID.randomUUID();

        RefreshToken t1 = RefreshToken.issue(userId, familyA, "hash-1", NOW.plusSeconds(3600), NOW);
        RefreshToken t2 = RefreshToken.issue(userId, familyA, "hash-2", NOW.plusSeconds(3600), NOW.plusSeconds(10));
        RefreshToken t3 = RefreshToken.issue(userId, familyB, "hash-3", NOW.plusSeconds(3600), NOW.plusSeconds(20));
        refreshTokenRepository.save(t1);
        refreshTokenRepository.save(t2);
        refreshTokenRepository.save(t3);

        assertThat(refreshTokenRepository.findByTokenHash("hash-1")).isPresent();

        RefreshToken duplicateHash = RefreshToken.issue(userId, familyB, "hash-1", NOW.plusSeconds(3600), NOW);
        assertThatThrownBy(() -> refreshTokenRepository.save(duplicateHash))
                .isInstanceOf(DuplicateKeyException.class);

        refreshTokenRepository.revokeFamily(familyA, NOW.plusSeconds(30));
        assertThat(refreshTokenRepository.findByTokenHash("hash-1").orElseThrow().isRevoked()).isTrue();
        assertThat(refreshTokenRepository.findByTokenHash("hash-2").orElseThrow().isRevoked()).isTrue();
        assertThat(refreshTokenRepository.findByTokenHash("hash-3").orElseThrow().isRevoked()).isFalse();

        refreshTokenRepository.revokeAllByUserId(userId, NOW.plusSeconds(40));
        assertThat(refreshTokenRepository.findByTokenHash("hash-3").orElseThrow().isRevoked()).isTrue();
    }
}
