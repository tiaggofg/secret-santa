package com.secretsanta.domain.service;

import com.secretsanta.domain.model.GeoCoordinates;
import com.secretsanta.domain.model.Participant;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

public final class HouseholdClusterService {

    public static final double HOUSEHOLD_RADIUS_METERS = 50.0;

    public Map<UUID, UUID> assignHouseholdClusters(List<Participant> participants) {
        Objects.requireNonNull(participants, "participants must not be null");
        int n = participants.size();
        if (n == 0) {
            return Map.of();
        }

        int[] parent = new int[n];
        for (int i = 0; i < n; i++) {
            parent[i] = i;
        }

        for (int i = 0; i < n; i++) {
            GeoCoordinates coordsI = participants.get(i).coordinates();
            if (coordsI == null) {
                continue;
            }
            for (int j = i + 1; j < n; j++) {
                GeoCoordinates coordsJ = participants.get(j).coordinates();
                if (coordsJ == null) {
                    continue;
                }
                if (coordsI.distanceInMetersTo(coordsJ) <= HOUSEHOLD_RADIUS_METERS) {
                    union(parent, i, j);
                }
            }
        }

        Map<Integer, UUID> rootClusterIds = new HashMap<>();
        Map<UUID, UUID> result = new LinkedHashMap<>();
        for (int i = 0; i < n; i++) {
            Participant participant = participants.get(i);
            if (participant.coordinates() == null) {
                result.put(participant.id(), UUID.randomUUID());
            } else {
                int root = find(parent, i);
                UUID clusterId = rootClusterIds.computeIfAbsent(root, k -> UUID.randomUUID());
                result.put(participant.id(), clusterId);
            }
        }

        return Collections.unmodifiableMap(result);
    }

    private static int find(int[] parent, int i) {
        int root = i;
        while (root != parent[root]) {
            root = parent[root];
        }
        int curr = i;
        while (curr != root) {
            int next = parent[curr];
            parent[curr] = root;
            curr = next;
        }
        return root;
    }

    private static void union(int[] parent, int i, int j) {
        int rootI = find(parent, i);
        int rootJ = find(parent, j);
        if (rootI != rootJ) {
            parent[rootJ] = rootI;
        }
    }
}
