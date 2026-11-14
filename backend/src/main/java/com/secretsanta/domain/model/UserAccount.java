package com.secretsanta.domain.model;

import com.secretsanta.domain.exception.DomainValidationException;
import com.secretsanta.domain.exception.InvalidPasswordResetTokenException;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public final class UserAccount {

    private final UUID id;
    private final ParticipantName name;
    private final Username username;
    private PinHash pinHash;
    private PasswordResetTokenHash resetTokenHash;
    private Instant resetTokenExpiresAt;
    private final Instant createdAt;
    private final Long version;

    private UserAccount(
            UUID id,
            ParticipantName name,
            Username username,
            PinHash pinHash,
            PasswordResetTokenHash resetTokenHash,
            Instant resetTokenExpiresAt,
            Instant createdAt,
            Long version) {
        this.id = Objects.requireNonNull(id, "id must not be null");
        this.name = Objects.requireNonNull(name, "name must not be null");
        this.username = Objects.requireNonNull(username, "username must not be null");
        this.pinHash = Objects.requireNonNull(pinHash, "pinHash must not be null");
        this.resetTokenHash = resetTokenHash;
        this.resetTokenExpiresAt = resetTokenExpiresAt;
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt must not be null");
        this.version = version;
    }

    public static UserAccount register(
            ParticipantName name,
            Username username,
            PinHash pinHash,
            Instant now) {
        return new UserAccount(
                UUID.randomUUID(),
                name,
                username,
                pinHash,
                null,
                null,
                now,
                null);
    }

    public static UserAccount reconstitute(
            UUID id,
            ParticipantName name,
            Username username,
            PinHash pinHash,
            PasswordResetTokenHash resetTokenHash,
            Instant resetTokenExpiresAt,
            Instant createdAt,
            Long version) {
        return new UserAccount(
                id,
                name,
                username,
                pinHash,
                resetTokenHash,
                resetTokenExpiresAt,
                createdAt,
                version);
    }

    public void issuePasswordResetToken(PasswordResetTokenHash tokenHash, Instant expiresAt) {
        if (tokenHash == null || expiresAt == null) {
            throw new DomainValidationException("Reset token hash and expiration must not be null");
        }
        this.resetTokenHash = tokenHash;
        this.resetTokenExpiresAt = expiresAt;
    }

    public void resetPinWithToken(PasswordResetTokenHash tokenHash, PinHash newPinHash, Instant now) {
        if (tokenHash == null || newPinHash == null || now == null) {
            throw new InvalidPasswordResetTokenException("Invalid password reset request");
        }
        if (this.resetTokenHash == null || this.resetTokenExpiresAt == null) {
            throw new InvalidPasswordResetTokenException("Reset token is invalid or has already been used");
        }
        if (now.isAfter(this.resetTokenExpiresAt)) {
            throw new InvalidPasswordResetTokenException("Reset token has expired");
        }
        if (!this.resetTokenHash.equals(tokenHash)) {
            throw new InvalidPasswordResetTokenException("Reset token does not match");
        }
        this.pinHash = newPinHash;
        this.resetTokenHash = null;
        this.resetTokenExpiresAt = null;
    }

    public UUID id() {
        return id;
    }

    public ParticipantName name() {
        return name;
    }

    public Username username() {
        return username;
    }

    public PinHash pinHash() {
        return pinHash;
    }

    public PasswordResetTokenHash resetTokenHash() {
        return resetTokenHash;
    }

    public Instant resetTokenExpiresAt() {
        return resetTokenExpiresAt;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Long version() {
        return version;
    }

    @Override
    public String toString() {
        return "UserAccount[id=" + id + ", name=" + name.value() + ", username=" + username.value() + "]";
    }
}
