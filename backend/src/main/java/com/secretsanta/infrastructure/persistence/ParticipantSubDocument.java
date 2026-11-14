package com.secretsanta.infrastructure.persistence;

import java.time.Instant;

public class ParticipantSubDocument {

    private String id;
    private String userId;
    private String name;
    private String username;
    private Double latitude;
    private Double longitude;
    private String householdClusterId;
    private String drawnParticipantId;
    private Instant revealedAt;
    private Instant createdAt;

    public ParticipantSubDocument() {
    }

    public ParticipantSubDocument(
            String id,
            String userId,
            String name,
            String username,
            Double latitude,
            Double longitude,
            String householdClusterId,
            String drawnParticipantId,
            Instant revealedAt,
            Instant createdAt) {
        this.id = id;
        this.userId = userId;
        this.name = name;
        this.username = username;
        this.latitude = latitude;
        this.longitude = longitude;
        this.householdClusterId = householdClusterId;
        this.drawnParticipantId = drawnParticipantId;
        this.revealedAt = revealedAt;
        this.createdAt = createdAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public String getHouseholdClusterId() {
        return householdClusterId;
    }

    public void setHouseholdClusterId(String householdClusterId) {
        this.householdClusterId = householdClusterId;
    }

    public String getDrawnParticipantId() {
        return drawnParticipantId;
    }

    public void setDrawnParticipantId(String drawnParticipantId) {
        this.drawnParticipantId = drawnParticipantId;
    }

    public Instant getRevealedAt() {
        return revealedAt;
    }

    public void setRevealedAt(Instant revealedAt) {
        this.revealedAt = revealedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
