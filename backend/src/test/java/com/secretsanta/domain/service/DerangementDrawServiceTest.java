package com.secretsanta.domain.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.secretsanta.domain.exception.InsufficientParticipantsForDrawException;
import com.secretsanta.domain.model.DrawResult;
import com.secretsanta.domain.model.GeoCoordinates;
import com.secretsanta.domain.model.GroupStatus;
import com.secretsanta.domain.model.Participant;
import com.secretsanta.domain.model.ParticipantName;
import com.secretsanta.domain.model.PinHash;
import com.secretsanta.domain.model.SecretSantaGroup;
import com.secretsanta.domain.model.Username;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DerangementDrawServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-13T18:00:00Z");

    private final HouseholdClusterService clusterService = new HouseholdClusterService();
    private final DerangementDrawService drawService = new DerangementDrawService();

    private static Participant participant(String name, String username, GeoCoordinates coords) {
        return Participant.createNew(
                UUID.randomUUID(),
                new ParticipantName(name),
                new Username(username),
                coords,
                NOW);
    }

    @Test
    void shouldGenerateStrictInterHouseholdDerangementWhenMaxClusterIsAtMostHalfN() {
        GeoCoordinates houseA = new GeoCoordinates(-23.420999, -51.933056);
        GeoCoordinates houseB = new GeoCoordinates(-23.465999, -51.933056); // ~5km away

        List<Participant> participants = List.of(
                participant("A1", "user.a1", houseA),
                participant("A2", "user.a2", houseA),
                participant("A3", "user.a3", houseA),
                participant("B1", "user.b1", houseB),
                participant("B2", "user.b2", houseB),
                participant("B3", "user.b3", houseB));

        Map<UUID, UUID> clusters = clusterService.assignHouseholdClusters(participants);

        for (int iteration = 0; iteration < 50; iteration++) {
            DrawResult result = drawService.computeDraw(participants, clusters);

            assertThat(result.geographicRestrictionRelaxed()).isFalse();
            assertBijectiveDerangement(participants, result.assignments());

            for (Participant giver : participants) {
                UUID receiverId = result.assignments().get(giver.id());
                assertThat(clusters.get(giver.id()))
                        .as("Giver %s must not draw someone from same household cluster", giver.username().value())
                        .isNotEqualTo(clusters.get(receiverId));
            }
        }
    }

    @Test
    void shouldHandleThreeHouseholdsWithBoundaryHallConditionCleanly() {
        GeoCoordinates house1 = new GeoCoordinates(-23.420000, -51.930000);
        GeoCoordinates house2 = new GeoCoordinates(-23.430000, -51.940000);
        GeoCoordinates house3 = new GeoCoordinates(-23.440000, -51.950000);

        // N = 7, floor(7/2) = 3, largest cluster = 3 (3 + 2 + 2) -> Hall condition holds!
        List<Participant> participants = List.of(
                participant("H1_1", "h1.1", house1),
                participant("H1_2", "h1.2", house1),
                participant("H1_3", "h1.3", house1),
                participant("H2_1", "h2.1", house2),
                participant("H2_2", "h2.2", house2),
                participant("H3_1", "h3.1", house3),
                participant("H3_2", "h3.2", house3));

        Map<UUID, UUID> clusters = clusterService.assignHouseholdClusters(participants);

        for (int iteration = 0; iteration < 30; iteration++) {
            DrawResult result = drawService.computeDraw(participants, clusters);
            assertThat(result.geographicRestrictionRelaxed()).isFalse();
            assertBijectiveDerangement(participants, result.assignments());
            for (Participant giver : participants) {
                UUID receiverId = result.assignments().get(giver.id());
                assertThat(clusters.get(giver.id())).isNotEqualTo(clusters.get(receiverId));
            }
        }
    }

    @Test
    void shouldTriggerAutomaticFallbackMinimizingIntraHouseholdCollisionsWhenHallConditionViolated() {
        GeoCoordinates mainHouse = new GeoCoordinates(-23.420999, -51.933056);
        GeoCoordinates externalHouse = new GeoCoordinates(-23.500000, -51.990000);

        // 5 in mainHouse + 1 external = 6 total (max_cluster = 5 > floor(6/2) = 3)
        List<Participant> participants = List.of(
                participant("Casa 1", "casa.1", mainHouse),
                participant("Casa 2", "casa.2", mainHouse),
                participant("Casa 3", "casa.3", mainHouse),
                participant("Casa 4", "casa.4", mainHouse),
                participant("Casa 5", "casa.5", mainHouse),
                participant("Externo 1", "externo.1", externalHouse));

        Map<UUID, UUID> clusters = clusterService.assignHouseholdClusters(participants);
        DrawResult result = drawService.computeDraw(participants, clusters);

        assertThat(result.geographicRestrictionRelaxed()).isTrue();
        assertBijectiveDerangement(participants, result.assignments());

        int intraClusterPairs = 0;
        for (Participant giver : participants) {
            UUID receiverId = result.assignments().get(giver.id());
            if (clusters.get(giver.id()).equals(clusters.get(receiverId))) {
                intraClusterPairs++;
            }
        }
        // With 5 in mainHouse and 1 external, at least 1 mainHouse draws external and external draws 1 mainHouse
        // so intraClusterPairs must be minimized to 4 (never 5 or 6)
        assertThat(intraClusterPairs).isEqualTo(4);
    }

    @Test
    void shouldHandleAllParticipantsInSameHouseholdViaFallbackWithoutSelfDraw() {
        GeoCoordinates singleHouse = new GeoCoordinates(-23.420999, -51.933056);
        List<Participant> participants = List.of(
                participant("P1", "p.1", singleHouse),
                participant("P2", "p.2", singleHouse),
                participant("P3", "p.3", singleHouse),
                participant("P4", "p.4", singleHouse));

        Map<UUID, UUID> clusters = clusterService.assignHouseholdClusters(participants);
        DrawResult result = drawService.computeDraw(participants, clusters);

        assertThat(result.geographicRestrictionRelaxed()).isTrue();
        assertBijectiveDerangement(participants, result.assignments());
    }

    @Test
    void shouldExecuteUniformDerangementWithRelaxedFalseWhenAllParticipantsDenyGps() {
        SecretSantaGroup group = SecretSantaGroup.create(
                "Natal Sem GPS",
                new PinHash("$2a$10$groupPinHash"),
                UUID.randomUUID(),
                NOW);
        group.registerParticipant(UUID.randomUUID(), new ParticipantName("Ana"), new Username("ana"), null, NOW);
        group.registerParticipant(UUID.randomUUID(), new ParticipantName("Bia"), new Username("bia"), null, NOW);
        group.registerParticipant(UUID.randomUUID(), new ParticipantName("Caio"), new Username("caio"), null, NOW);
        group.registerParticipant(UUID.randomUUID(), new ParticipantName("Dani"), new Username("dani"), null, NOW);

        DrawResult result = group.executeDraw(clusterService, drawService, NOW);

        assertThat(result.geographicRestrictionRelaxed()).isFalse();
        assertThat(group.status()).isEqualTo(GroupStatus.DRAWN);
        assertThat(group.geographicRestrictionRelaxed()).isFalse();
        assertBijectiveDerangement(group.participants(), result.assignments());
    }

    @Test
    void shouldRejectFewerThanThreeParticipants() {
        List<Participant> twoParticipants = List.of(
                participant("Ana", "ana", null),
                participant("Bia", "bia", null));
        Map<UUID, UUID> clusters = clusterService.assignHouseholdClusters(twoParticipants);

        assertThatThrownBy(() -> drawService.computeDraw(twoParticipants, clusters))
                .isInstanceOf(InsufficientParticipantsForDrawException.class);
    }

    private static void assertBijectiveDerangement(
            List<Participant> participants,
            Map<UUID, UUID> assignments) {
        assertThat(assignments).hasSize(participants.size());
        Set<UUID> participantIds = new HashSet<>();
        for (Participant p : participants) {
            participantIds.add(p.id());
        }
        Set<UUID> receivers = new HashSet<>();
        for (Participant giver : participants) {
            UUID receiverId = assignments.get(giver.id());
            assertThat(receiverId).isNotNull();
            assertThat(receiverId).isNotEqualTo(giver.id());
            assertThat(participantIds).contains(receiverId);
            receivers.add(receiverId);
        }
        assertThat(receivers).hasSize(participants.size());
    }
}
