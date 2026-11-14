package com.secretsanta.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.secretsanta.domain.exception.InvalidPasswordResetTokenException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;

class UserAccountTest {

    @Test
    void shouldRegisterUserAccountAndMaskSensitiveFieldsInToString() {
        Instant now = Instant.parse("2026-11-13T18:00:00Z");
        UserAccount user = UserAccount.register(
                new ParticipantName("Tiago Godoy"),
                new Username("Tiago.Godoy"),
                new PinHash("$2a$10$secretBcryptHashValue"),
                now);

        assertThat(user.id()).isNotNull();
        assertThat(user.name().value()).isEqualTo("Tiago Godoy");
        assertThat(user.username().value()).isEqualTo("tiago.godoy");
        assertThat(user.pinHash().value()).isEqualTo("$2a$10$secretBcryptHashValue");
        assertThat(user.resetTokenHash()).isNull();
        assertThat(user.resetTokenExpiresAt()).isNull();
        assertThat(user.createdAt()).isEqualTo(now);
        assertThat(user.toString()).doesNotContain("$2a$10$secretBcryptHashValue");
    }

    @Test
    void shouldIssueAndConsumeOneTimePasswordResetTokenImmediatelyInvalidatingIt() {
        Instant now = Instant.parse("2026-11-13T18:00:00Z");
        UserAccount user = UserAccount.register(
                new ParticipantName("Maria Silva"),
                new Username("maria.silva"),
                new PinHash("$2a$10$oldHash"),
                now);

        PasswordResetTokenHash tokenHash = new PasswordResetTokenHash("sha256-reset-token-hash-001");
        Instant expiresAt = now.plus(24, ChronoUnit.HOURS);
        user.issuePasswordResetToken(tokenHash, expiresAt);

        assertThat(user.resetTokenHash()).isEqualTo(tokenHash);
        assertThat(user.resetTokenExpiresAt()).isEqualTo(expiresAt);
        assertThat(user.toString()).doesNotContain("sha256-reset-token-hash-001");

        PinHash newPinHash = new PinHash("$2a$10$newHashAfterReset");
        user.resetPinWithToken(tokenHash, newPinHash, now.plus(1, ChronoUnit.HOURS));

        assertThat(user.pinHash()).isEqualTo(newPinHash);
        assertThat(user.resetTokenHash()).isNull();
        assertThat(user.resetTokenExpiresAt()).isNull();

        // Reusing the same token a second time must fail immediately (one-time token)
        assertThatThrownBy(() -> user.resetPinWithToken(
                        tokenHash,
                        new PinHash("$2a$10$anotherHash"),
                        now.plus(2, ChronoUnit.HOURS)))
                .isInstanceOf(InvalidPasswordResetTokenException.class);
    }

    @Test
    void shouldRejectExpiredOrMismatchedPasswordResetToken() {
        Instant now = Instant.parse("2026-11-13T18:00:00Z");
        UserAccount user = UserAccount.register(
                new ParticipantName("João Silva"),
                new Username("joao.silva"),
                new PinHash("$2a$10$initialHash"),
                now);

        PasswordResetTokenHash validToken = new PasswordResetTokenHash("valid-token-hash");
        Instant expiresAt = now.plus(24, ChronoUnit.HOURS);
        user.issuePasswordResetToken(validToken, expiresAt);

        // Wrong token
        assertThatThrownBy(() -> user.resetPinWithToken(
                        new PasswordResetTokenHash("wrong-token-hash"),
                        new PinHash("$2a$10$newHash"),
                        now.plus(1, ChronoUnit.HOURS)))
                .isInstanceOf(InvalidPasswordResetTokenException.class);

        // Expired token (24h + 1s later)
        assertThatThrownBy(() -> user.resetPinWithToken(
                        validToken,
                        new PinHash("$2a$10$newHash"),
                        expiresAt.plusSeconds(1)))
                .isInstanceOf(InvalidPasswordResetTokenException.class);

        assertThat(user.pinHash().value()).isEqualTo("$2a$10$initialHash");
    }
}
