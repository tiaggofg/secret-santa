package com.secretsanta.application;

import java.util.Objects;
import java.util.UUID;

public final class AlreadyParticipantAuthenticatedException extends RuntimeException {

    private final UUID userId;
    private final String name;
    private final String username;
    private final UUID groupId;
    private final String accessToken;
    private final String refreshToken;

    public AlreadyParticipantAuthenticatedException(
            UUID userId,
            String name,
            String username,
            UUID groupId,
            String accessToken,
            String refreshToken) {
        super("User is already registered as a participant in this group");
        this.userId = Objects.requireNonNull(userId, "userId must not be null");
        this.name = Objects.requireNonNull(name, "name must not be null");
        this.username = Objects.requireNonNull(username, "username must not be null");
        this.groupId = Objects.requireNonNull(groupId, "groupId must not be null");
        this.accessToken = Objects.requireNonNull(accessToken, "accessToken must not be null");
        this.refreshToken = Objects.requireNonNull(refreshToken, "refreshToken must not be null");
    }

    public UUID userId() {
        return userId;
    }

    public String name() {
        return name;
    }

    public String username() {
        return username;
    }

    public UUID groupId() {
        return groupId;
    }

    public String accessToken() {
        return accessToken;
    }

    public String refreshToken() {
        return refreshToken;
    }
}
