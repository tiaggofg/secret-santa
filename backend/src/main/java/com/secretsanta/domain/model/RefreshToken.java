package com.secretsanta.domain.model;

import com.secretsanta.domain.exception.DomainValidationException;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public record RefreshToken(
        UUID id,
        UUID userId,
        UUID familyId,
        String tokenHash,
        Instant expiresAt,
        Instant revokedAt,
        Instant createdAt) {

    public RefreshToken {
        Objects.requireNonNull(id, "id must not be null");
        Objects.requireNonNull(userId, "userId must not be null");
        Objects.requireNonNull(familyId, "familyId must not be null");
        if (tokenHash == null || tokenHash.isBlank()) {
            throw new DomainValidationException("tokenHash must not be blank");
        }
        Objects.requireNonNull(expiresAt, "expiresAt must not be null");
        Objects.requireNonNull(createdAt, "createdAt must not be null");
    }

    public static RefreshToken issue(
            UUID userId,
            UUID familyId,
            String tokenHash,
            Instant expiresAt,
            Instant now) {
        return new RefreshToken(UUID.randomUUID(), userId, familyId, tokenHash, expiresAt, null, now);
    }

    public boolean isExpired(Instant now) {
        Objects.requireNonNull(now, "now must not be null");
        return !now.isBefore(expiresAt);
    }

    public boolean isRevoked() {
        return revokedAt != null;
    }

    public RefreshToken revoke(Instant now) {
        Objects.requireNonNull(now, "now must not be null");
        if (revokedAt != null) {
            return this;
        }
        return new RefreshToken(id, userId, familyId, tokenHash, expiresAt, now, createdAt);
    }

    @Override
    public String toString() {
        return "RefreshToken[id=" + id
                + ", userId=" + userId
                + ", familyId=" + familyId
                + ", expiresAt=" + expiresAt
                + ", revokedAt=" + revokedAt + "]";
    }
}
