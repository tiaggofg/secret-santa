package com.secretsanta.domain.service;

import com.secretsanta.domain.exception.DomainValidationException;
import com.secretsanta.domain.exception.InsufficientParticipantsForDrawException;
import com.secretsanta.domain.model.DrawResult;
import com.secretsanta.domain.model.Participant;
import com.secretsanta.domain.model.SecretSantaGroup;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

public final class DerangementDrawService {

    private final SecureRandom random = new SecureRandom();

    public DrawResult computeDraw(List<Participant> participants, HouseholdClusterService clusterService) {
        Objects.requireNonNull(participants, "participants must not be null");
        Objects.requireNonNull(clusterService, "clusterService must not be null");
        Map<UUID, UUID> clusters = clusterService.assignHouseholdClusters(participants);
        return computeDraw(participants, clusters);
    }

    public DrawResult computeDraw(List<Participant> participants, Map<UUID, UUID> householdClusters) {
        Objects.requireNonNull(participants, "participants must not be null");
        Objects.requireNonNull(householdClusters, "householdClusters must not be null");

        int n = participants.size();
        if (n < SecretSantaGroup.MIN_PARTICIPANTS_FOR_DRAW) {
            throw new InsufficientParticipantsForDrawException(
                    "At least 3 participants are required to execute the Secret Santa draw");
        }

        Map<UUID, List<Participant>> membersByCluster = new LinkedHashMap<>();
        for (Participant participant : participants) {
            UUID clusterId = householdClusters.get(participant.id());
            if (clusterId == null) {
                throw new DomainValidationException("Missing householdClusterId for participant " + participant.id());
            }
            membersByCluster.computeIfAbsent(clusterId, k -> new ArrayList<>()).add(participant);
        }

        int maxClusterSize = membersByCluster.values().stream()
                .mapToInt(List::size)
                .max()
                .orElse(0);

        boolean canSatisfyStrictInterHousehold = maxClusterSize <= (n / 2);
        if (canSatisfyStrictInterHousehold) {
            Map<UUID, UUID> strictAssignments = generateStrictInterHouseholdDerangement(
                    participants, householdClusters, membersByCluster, maxClusterSize);
            return new DrawResult(householdClusters, strictAssignments, false);
        }

        Map<UUID, UUID> fallbackAssignments = generateMinimalCollisionFallbackDerangement(
                n, membersByCluster, maxClusterSize);
        return new DrawResult(householdClusters, fallbackAssignments, true);
    }

    private Map<UUID, UUID> generateStrictInterHouseholdDerangement(
            List<Participant> participants,
            Map<UUID, UUID> householdClusters,
            Map<UUID, List<Participant>> membersByCluster,
            int maxClusterSize) {
        int n = participants.size();
        List<Participant> shuffledGivers = new ArrayList<>(participants);
        Collections.shuffle(shuffledGivers, random);

        // Build shuffled candidate receiver indices for each giver and find a perfect bipartite matching
        List<List<Integer>> adj = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            UUID giverCluster = householdClusters.get(shuffledGivers.get(i).id());
            List<Integer> candidates = new ArrayList<>();
            for (int j = 0; j < n; j++) {
                if (i != j && !giverCluster.equals(householdClusters.get(shuffledGivers.get(j).id()))) {
                    candidates.add(j);
                }
            }
            Collections.shuffle(candidates, random);
            adj.add(candidates);
        }

        int[] matchReceiverToGiver = new int[n];
        java.util.Arrays.fill(matchReceiverToGiver, -1);

        boolean allMatched = true;
        for (int giverIdx = 0; giverIdx < n; giverIdx++) {
            boolean[] visited = new boolean[n];
            if (!augment(giverIdx, adj, matchReceiverToGiver, visited)) {
                allMatched = false;
                break;
            }
        }

        if (allMatched) {
            Map<UUID, UUID> assignments = new LinkedHashMap<>();
            for (int receiverIdx = 0; receiverIdx < n; receiverIdx++) {
                int giverIdx = matchReceiverToGiver[receiverIdx];
                assignments.put(
                        shuffledGivers.get(giverIdx).id(),
                        shuffledGivers.get(receiverIdx).id());
            }
            return Collections.unmodifiableMap(assignments);
        }

        // Guaranteed O(N) mathematical shift construction when maxClusterSize <= N / 2
        return shiftDerangementByClusters(n, membersByCluster, maxClusterSize);
    }

    private static boolean augment(
            int giverIdx,
            List<List<Integer>> adj,
            int[] matchReceiverToGiver,
            boolean[] visited) {
        for (int receiverIdx : adj.get(giverIdx)) {
            if (visited[receiverIdx]) {
                continue;
            }
            visited[receiverIdx] = true;
            if (matchReceiverToGiver[receiverIdx] == -1
                    || augment(matchReceiverToGiver[receiverIdx], adj, matchReceiverToGiver, visited)) {
                matchReceiverToGiver[receiverIdx] = giverIdx;
                return true;
            }
        }
        return false;
    }

    private Map<UUID, UUID> generateMinimalCollisionFallbackDerangement(
            int n,
            Map<UUID, List<Participant>> membersByCluster,
            int maxClusterSize) {
        int shift = (maxClusterSize < n) ? (n - maxClusterSize) : 1;
        return shiftDerangementByClusters(n, membersByCluster, shift);
    }

    private Map<UUID, UUID> shiftDerangementByClusters(
            int n,
            Map<UUID, List<Participant>> membersByCluster,
            int shift) {
        List<List<Participant>> clusterLists = new ArrayList<>(membersByCluster.values());
        Collections.shuffle(clusterLists, random);
        clusterLists.sort(Comparator.comparingInt((List<Participant> list) -> list.size()).reversed());

        List<Participant> ordered = new ArrayList<>(n);
        for (List<Participant> clusterMembers : clusterLists) {
            List<Participant> copy = new ArrayList<>(clusterMembers);
            Collections.shuffle(copy, random);
            ordered.addAll(copy);
        }

        Map<UUID, UUID> assignments = new LinkedHashMap<>();
        for (int i = 0; i < n; i++) {
            Participant giver = ordered.get(i);
            Participant receiver = ordered.get((i + shift) % n);
            assignments.put(giver.id(), receiver.id());
        }
        return Collections.unmodifiableMap(assignments);
    }
}
