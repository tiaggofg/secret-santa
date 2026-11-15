package com.secretsanta.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.secretsanta.domain.exception.DomainValidationException;
import com.secretsanta.domain.exception.DuplicateParticipantException;
import com.secretsanta.domain.exception.GroupAlreadyDrawnException;
import com.secretsanta.domain.exception.GroupNotDrawnYetException;
import com.secretsanta.domain.exception.InsufficientParticipantsForDrawException;
import com.secretsanta.domain.exception.ResourceNotFoundException;
import com.secretsanta.domain.exception.UnauthorizedOrganizerAccessException;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SecretSantaGroupTest {

    private static final Instant NOW = Instant.parse("2026-11-13T18:00:00Z");
    private static final PinHash GROUP_PIN_HASH = new PinHash("$2a$10$groupPinHashValue");

    @Test
    void shouldCreateGroupValidateEventNameAndEnforceOrganizerPermission() {
        UUID organizerId = UUID.randomUUID();
        SecretSantaGroup group = SecretSantaGroup.create(
                "  Natal Família Godoy  ",
                GROUP_PIN_HASH,
                organizerId,
                NOW);

        assertThat(group.id()).isNotNull();
        assertThat(group.eventName()).isEqualTo("Natal Família Godoy");
        assertThat(group.groupPinHash()).isEqualTo(GROUP_PIN_HASH);
        assertThat(group.organizerUserId()).isEqualTo(organizerId);
        assertThat(group.status()).isEqualTo(GroupStatus.OPEN);
        assertThat(group.geographicRestrictionRelaxed()).isFalse();
        assertThat(group.participants()).isEmpty();

        PinHash updatedPinHash = new PinHash("$2a$10$newGroupPinHashValue");
        group.updateGroupPinHash(updatedPinHash);
        assertThat(group.groupPinHash()).isEqualTo(updatedPinHash);

        group.assertOrganizer(organizerId);

        UUID otherUserId = UUID.randomUUID();
        assertThatThrownBy(() -> group.assertOrganizer(otherUserId))
                .isInstanceOf(UnauthorizedOrganizerAccessException.class);

        assertThatThrownBy(() -> SecretSantaGroup.create("ab", GROUP_PIN_HASH, organizerId, NOW))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> SecretSantaGroup.create("a".repeat(101), GROUP_PIN_HASH, organizerId, NOW))
                .isInstanceOf(DomainValidationException.class);
    }

    @Test
    void shouldRegisterParticipantsRejectDuplicatesAndAllowRemovalWhileOpen() {
        UUID organizerId = UUID.randomUUID();
        SecretSantaGroup group = SecretSantaGroup.create(
                "Natal da Família",
                GROUP_PIN_HASH,
                organizerId,
                NOW);

        UUID user1 = UUID.randomUUID();
        Participant p1 = group.registerParticipant(
                user1,
                new ParticipantName("Ana"),
                new Username("ana.silva"),
                new GeoCoordinates(-23.42, -51.93),
                NOW);

        assertThat(p1.hasGeoLocation()).isTrue();
        assertThat(p1.revealStatus(group.status())).isEqualTo(RevealStatus.WAITING_DRAW);
        assertThat(group.participants()).hasSize(1);

        // Duplicate userId
        assertThatThrownBy(() -> group.registerParticipant(
                        user1,
                        new ParticipantName("Ana 2"),
                        new Username("ana.dois"),
                        null,
                        NOW))
                .isInstanceOf(DuplicateParticipantException.class);

        // Duplicate username
        assertThatThrownBy(() -> group.registerParticipant(
                        UUID.randomUUID(),
                        new ParticipantName("Outra Ana"),
                        new Username("ANA.SILVA"),
                        null,
                        NOW))
                .isInstanceOf(DuplicateParticipantException.class);

        group.removeParticipant(p1.id());
        assertThat(group.participants()).isEmpty();

        assertThatThrownBy(() -> group.removeParticipant(p1.id()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void shouldRejectDrawWithFewerThanThreeParticipants() {
        SecretSantaGroup group = SecretSantaGroup.create(
                "Natal Pequeno",
                GROUP_PIN_HASH,
                UUID.randomUUID(),
                NOW);

        group.registerParticipant(UUID.randomUUID(), new ParticipantName("Ana"), new Username("ana"), null, NOW);
        group.registerParticipant(UUID.randomUUID(), new ParticipantName("Bia"), new Username("bia"), null, NOW);

        assertThatThrownBy(() -> group.executeDraw(participants -> new DrawResult(Map.of(), Map.of(), false), NOW))
                .isInstanceOf(InsufficientParticipantsForDrawException.class);
    }

    @Test
    void shouldExecuteDrawLockGroupRevealDrawnNameAndProtectSecrecyInToString() {
        SecretSantaGroup group = SecretSantaGroup.create(
                "Natal Completo",
                GROUP_PIN_HASH,
                UUID.randomUUID(),
                NOW);

        Participant p1 = group.registerParticipant(
                UUID.randomUUID(), new ParticipantName("Ana"), new Username("ana"), null, NOW);
        Participant p2 = group.registerParticipant(
                UUID.randomUUID(), new ParticipantName("Bruno"), new Username("bruno"), null, NOW);
        Participant p3 = group.registerParticipant(
                UUID.randomUUID(), new ParticipantName("Carla"), new Username("carla"), null, NOW);

        // Reveal before draw must fail with GroupNotDrawnYetException
        assertThatThrownBy(() -> group.markRevealedAndGetDrawnName(p1.id(), NOW))
                .isInstanceOf(GroupNotDrawnYetException.class);

        UUID c1 = UUID.randomUUID();
        UUID c2 = UUID.randomUUID();
        UUID c3 = UUID.randomUUID();
        Instant drawTime = NOW.plusSeconds(60);

        DrawResult drawResult = group.executeDraw(participants -> new DrawResult(
                Map.of(p1.id(), c1, p2.id(), c2, p3.id(), c3),
                Map.of(p1.id(), p2.id(), p2.id(), p3.id(), p3.id(), p1.id()),
                false), drawTime);

        assertThat(drawResult.geographicRestrictionRelaxed()).isFalse();
        assertThat(group.status()).isEqualTo(GroupStatus.DRAWN);
        assertThat(group.drawnAt()).isEqualTo(drawTime);

        // Participant toString must never expose drawnParticipantId
        Participant updatedP1 = group.findParticipantByUsername(new Username("ana"));
        assertThat(updatedP1.toString()).doesNotContain(p2.id().toString());
        assertThat(updatedP1.revealStatus(group.status())).isEqualTo(RevealStatus.PENDING_REVEAL);

        // Cannot register, remove, or draw again once DRAWN
        assertThatThrownBy(() -> group.registerParticipant(
                        UUID.randomUUID(), new ParticipantName("Daniel"), new Username("daniel"), null, drawTime))
                .isInstanceOf(GroupAlreadyDrawnException.class);
        assertThatThrownBy(() -> group.removeParticipant(p1.id()))
                .isInstanceOf(GroupAlreadyDrawnException.class);
        assertThatThrownBy(() -> group.executeDraw(participants -> drawResult, drawTime))
                .isInstanceOf(GroupAlreadyDrawnException.class);

        // Reveal drawn name for Ana -> Bruno
        Instant revealTime = drawTime.plusSeconds(120);
        String drawnName = group.markRevealedAndGetDrawnName(p1.id(), revealTime);
        assertThat(drawnName).isEqualTo("Bruno");
        assertThat(group.findParticipantByUsername(new Username("ana")).revealedAt()).isEqualTo(revealTime);
        assertThat(group.findParticipantByUsername(new Username("ana")).revealStatus(group.status()))
                .isEqualTo(RevealStatus.REVEALED);
    }
}
