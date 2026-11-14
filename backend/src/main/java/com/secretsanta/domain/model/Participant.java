package com.secretsanta.domain.model;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public final class Participant {

    private final UUID id;
    private final UUID userId;
    private final ParticipantName name;
    private final Username username;
    private final GeoCoordinates coordinates;
    private UUID householdClusterId;
    private UUID drawnParticipantId;
    private Instant revealedAt;
    private final Instant createdAt;

    private Participant(
            UUID id,
            UUID userId,
            ParticipantName name,
            Username username,
            GeoCoordinates coordinates,
            UUID householdClusterId,
            UUID drawnParticipantId,
            Instant revealedAt,
            Instant createdAt) {
        this.id = Objects.requireNonNull(id, "id must not be null");
        this.userId = Objects.requireNonNull(userId, "userId must not be null");
        this.name = Objects.requireNonNull(name, "name must not be null");
        this.username = Objects.requireNonNull(username, "username must not be null");
        this.coordinates = coordinates;
        this.householdClusterId = householdClusterId;
        this.drawnParticipantId = drawnParticipantId;
        this.revealedAt = revealedAt;
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt must not be null");
    }

    public static Participant createNew(
            UUID userId,
            ParticipantName name,
            Username username,
            GeoCoordinates coordinates,
            Instant now) {
        return new Participant(
                UUID.randomUUID(),
                userId,
                name,
                username,
                coordinates,
                null,
                null,
                null,
                now);
    }

    public static Participant reconstitute(
            UUID id,
            UUID userId,
            ParticipantName name,
            Username username,
            GeoCoordinates coordinates,
            UUID householdClusterId,
            UUID drawnParticipantId,
            Instant revealedAt,
            Instant createdAt) {
        return new Participant(
                id,
                userId,
                name,
                username,
                coordinates,
                householdClusterId,
                drawnParticipantId,
                revealedAt,
                createdAt);
    }

    void assignDrawOutcome(UUID householdClusterId, UUID drawnParticipantId) {
        this.householdClusterId = Objects.requireNonNull(householdClusterId, "householdClusterId must not be null");
        this.drawnParticipantId = Objects.requireNonNull(drawnParticipantId, "drawnParticipantId must not be null");
    }

    void markRevealed(Instant now) {
        if (this.revealedAt == null) {
            this.revealedAt = Objects.requireNonNull(now, "now must not be null");
        }
    }

    public UUID id() {
        return id;
    }

    public UUID userId() {
        return userId;
    }

    public ParticipantName name() {
        return name;
    }

    public Username username() {
        return username;
    }

    public GeoCoordinates coordinates() {
        return coordinates;
    }

    public boolean hasGeoLocation() {
        return coordinates != null;
    }

    public UUID householdClusterId() {
        return householdClusterId;
    }

    public UUID drawnParticipantId() {
        return drawnParticipantId;
    }

    public Instant revealedAt() {
        return revealedAt;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public RevealStatus revealStatus(GroupStatus groupStatus) {
        if (groupStatus == GroupStatus.OPEN) {
            return RevealStatus.WAITING_DRAW;
        }
        return revealedAt != null ? RevealStatus.REVEALED : RevealStatus.PENDING_REVEAL;
    }

    @Override
    public String toString() {
        return "Participant[id=" + id
                + ", userId=" + userId
                + ", name=" + name.value()
                + ", username=" + username.value()
                + ", hasGeoLocation=" + hasGeoLocation()
                + "]";
    }
}
