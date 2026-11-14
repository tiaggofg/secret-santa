package com.secretsanta.domain.model;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;

public record DrawResult(
        Map<UUID, UUID> householdClusters,
        Map<UUID, UUID> assignments,
        boolean geographicRestrictionRelaxed) {

    public DrawResult {
        householdClusters = Map.copyOf(Objects.requireNonNull(householdClusters, "householdClusters must not be null"));
        assignments = Map.copyOf(Objects.requireNonNull(assignments, "assignments must not be null"));
    }
}
