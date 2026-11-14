package com.secretsanta.domain.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.secretsanta.domain.model.GeoCoordinates;
import com.secretsanta.domain.model.Participant;
import com.secretsanta.domain.model.ParticipantName;
import com.secretsanta.domain.model.Username;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HouseholdClusterServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-13T18:00:00Z");
    private final HouseholdClusterService service = new HouseholdClusterService();

    private static Participant participant(String name, String username, GeoCoordinates coords) {
        return Participant.createNew(
                UUID.randomUUID(),
                new ParticipantName(name),
                new Username(username),
                coords,
                NOW);
    }

    @Test
    void shouldGroupParticipantsWithin50MetersIntoSameHouseholdCluster() {
        GeoCoordinates homeBase = new GeoCoordinates(-23.420999, -51.933056);
        // ~15m away
        GeoCoordinates sofa = new GeoCoordinates(-23.420865, -51.933056);
        // ~5km away (another house)
        GeoCoordinates otherHouse1 = new GeoCoordinates(-23.465999, -51.933056);
        GeoCoordinates otherHouse2 = new GeoCoordinates(-23.466050, -51.933056);

        Participant p1 = participant("Pai", "pai", homeBase);
        Participant p2 = participant("Mae", "mae", sofa);
        Participant p3 = participant("Tio", "tio", otherHouse1);
        Participant p4 = participant("Tia", "tia", otherHouse2);

        Map<UUID, UUID> clusters = service.assignHouseholdClusters(List.of(p1, p2, p3, p4));

        assertThat(clusters).hasSize(4);
        assertThat(clusters.get(p1.id())).isEqualTo(clusters.get(p2.id()));
        assertThat(clusters.get(p3.id())).isEqualTo(clusters.get(p4.id()));
        assertThat(clusters.get(p1.id())).isNotEqualTo(clusters.get(p3.id()));
    }

    @Test
    void shouldApplyTransitiveClosureViaUnionFindWhenChainedWithin50Meters() {
        // 1 deg latitude at equator ~ 111,194.9266m -> 40m ~ 0.0003597286 deg
        double step40m = Math.toDegrees(40.0 / GeoCoordinates.EARTH_RADIUS_METERS);
        GeoCoordinates pointA = new GeoCoordinates(0.0, 0.0);
        GeoCoordinates pointB = new GeoCoordinates(step40m, 0.0);       // 40m from A
        GeoCoordinates pointC = new GeoCoordinates(step40m * 2.0, 0.0); // 40m from B, 80m from A

        assertThat(pointA.distanceInMetersTo(pointB)).isLessThanOrEqualTo(50.0);
        assertThat(pointB.distanceInMetersTo(pointC)).isLessThanOrEqualTo(50.0);
        assertThat(pointA.distanceInMetersTo(pointC)).isGreaterThan(50.0);

        Participant pA = participant("Pessoa A", "pessoa.a", pointA);
        Participant pB = participant("Pessoa B", "pessoa.b", pointB);
        Participant pC = participant("Pessoa C", "pessoa.c", pointC);

        Map<UUID, UUID> clusters = service.assignHouseholdClusters(List.of(pA, pB, pC));

        UUID clusterA = clusters.get(pA.id());
        assertThat(clusterA)
                .isEqualTo(clusters.get(pB.id()))
                .isEqualTo(clusters.get(pC.id()));
    }

    @Test
    void shouldIncludeBoundaryDistanceOfExactly50MetersInSameCluster() {
        double degFor49_99m = Math.toDegrees(49.999 / GeoCoordinates.EARTH_RADIUS_METERS);
        double degFor50_01m = Math.toDegrees(50.001 / GeoCoordinates.EARTH_RADIUS_METERS);

        Participant origin = participant("Origem", "origem", new GeoCoordinates(0.0, 0.0));
        Participant insideBoundary = participant("Dentro", "dentro", new GeoCoordinates(degFor49_99m, 0.0));
        Participant outsideBoundary = participant("Fora", "fora", new GeoCoordinates(degFor50_01m * 3, 0.0));

        Map<UUID, UUID> clusters = service.assignHouseholdClusters(
                List.of(origin, insideBoundary, outsideBoundary));

        assertThat(clusters.get(origin.id())).isEqualTo(clusters.get(insideBoundary.id()));
        assertThat(clusters.get(origin.id())).isNotEqualTo(clusters.get(outsideBoundary.id()));
    }

    @Test
    void shouldAssignUniqueIsolatedClusterToEachParticipantWithNullCoordinates() {
        Participant noGeo1 = participant("Sem GPS 1", "sem.gps.1", null);
        Participant noGeo2 = participant("Sem GPS 2", "sem.gps.2", null);
        Participant noGeo3 = participant("Sem GPS 3", "sem.gps.3", null);
        Participant withGeo1 = participant("Com GPS 1", "com.gps.1", new GeoCoordinates(-23.42, -51.93));
        Participant withGeo2 = participant("Com GPS 2", "com.gps.2", new GeoCoordinates(-23.42, -51.93));

        Map<UUID, UUID> clusters = service.assignHouseholdClusters(
                List.of(noGeo1, noGeo2, noGeo3, withGeo1, withGeo2));

        assertThat(clusters.get(withGeo1.id())).isEqualTo(clusters.get(withGeo2.id()));

        Set<UUID> distinctClusters = new HashSet<>(clusters.values());
        // 3 isolated singleton clusters + 1 shared household cluster = 4 distinct cluster IDs
        assertThat(distinctClusters).hasSize(4);
        assertThat(clusters.get(noGeo1.id()))
                .isNotEqualTo(clusters.get(noGeo2.id()))
                .isNotEqualTo(clusters.get(noGeo3.id()))
                .isNotEqualTo(clusters.get(withGeo1.id()));
    }
}
