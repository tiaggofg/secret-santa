package com.secretsanta.application;

import com.secretsanta.domain.exception.InvalidCredentialsException;
import com.secretsanta.domain.model.InviteSignature;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Objects;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class StatelessSessionTokenService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String BEARER_PREFIX = "Bearer ";
    private static final int INVITE_NONCE_BYTES = 16;

    private final byte[] secretBytes;
    private final Duration tokenTtl;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    @Autowired
    public StatelessSessionTokenService(
            @Value("${secretsanta.security.token-secret:default-dev-secret-key-with-at-least-32-bytes-length-2026}") String secret,
            @Value("${secretsanta.security.access-token-ttl-minutes:15}") long accessTokenTtlMinutes) {
        this(secret, Duration.ofMinutes(accessTokenTtlMinutes), Clock.systemUTC());
    }

    public StatelessSessionTokenService(String secret, Duration tokenTtl, Clock clock) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalArgumentException("Token secret must not be blank");
        }
        this.secretBytes = secret.getBytes(StandardCharsets.UTF_8);
        this.tokenTtl = Objects.requireNonNull(tokenTtl, "tokenTtl must not be null");
        this.clock = Objects.requireNonNull(clock, "clock must not be null");
    }

    public long accessTokenTtlSeconds() {
        return tokenTtl.toSeconds();
    }

    public InviteSignature generateInviteSignature(UUID groupId) {
        Objects.requireNonNull(groupId, "groupId must not be null");
        byte[] nonce = new byte[INVITE_NONCE_BYTES];
        secureRandom.nextBytes(nonce);
        String nonceBase64Url = Base64.getUrlEncoder().withoutPadding().encodeToString(nonce);
        String signature = sign(groupId + ":" + nonceBase64Url);
        return new InviteSignature(signature);
    }

    public String issueToken(UUID userId, String username) {
        return issueToken(userId, username, Instant.now(clock));
    }

    public String issueToken(UUID userId, String username, Instant issuedAt) {
        Objects.requireNonNull(userId, "userId must not be null");
        Objects.requireNonNull(username, "username must not be null");
        Objects.requireNonNull(issuedAt, "issuedAt must not be null");

        Instant expiresAt = issuedAt.plus(tokenTtl);
        String payload = userId + ":" + username + ":" + expiresAt.getEpochSecond();
        String encodedPayload = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        String signature = sign(encodedPayload);
        return encodedPayload + "." + signature;
    }

    public AuthenticatedUser parseAndValidate(String tokenOrAuthorizationHeader) {
        return parseAndValidate(tokenOrAuthorizationHeader, Instant.now(clock));
    }

    public AuthenticatedUser parseAndValidate(String tokenOrAuthorizationHeader, Instant now) {
        String rawToken = extractRawToken(tokenOrAuthorizationHeader);
        int dotIndex = rawToken.indexOf('.');
        if (dotIndex <= 0 || dotIndex != rawToken.lastIndexOf('.') || dotIndex == rawToken.length() - 1) {
            throw new InvalidCredentialsException("Invalid session token format");
        }

        String encodedPayload = rawToken.substring(0, dotIndex);
        String providedSignature = rawToken.substring(dotIndex + 1);
        String expectedSignature = sign(encodedPayload);

        if (!MessageDigest.isEqual(
                providedSignature.getBytes(StandardCharsets.UTF_8),
                expectedSignature.getBytes(StandardCharsets.UTF_8))) {
            throw new InvalidCredentialsException("Invalid session token signature");
        }

        final String payload;
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(encodedPayload);
            payload = new String(decoded, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ex) {
            throw new InvalidCredentialsException("Malformed session token payload");
        }

        String[] parts = payload.split(":", 3);
        if (parts.length != 3) {
            throw new InvalidCredentialsException("Malformed session token claims");
        }

        final UUID userId;
        final String username = parts[1];
        final Instant expiresAt;
        try {
            userId = UUID.fromString(parts[0]);
            long epochSeconds = Long.parseLong(parts[2]);
            expiresAt = Instant.ofEpochSecond(epochSeconds);
        } catch (IllegalArgumentException ex) {
            throw new InvalidCredentialsException("Invalid session token claims");
        }

        if (username.isBlank()) {
            throw new InvalidCredentialsException("Invalid session token username claim");
        }
        if (now.isAfter(expiresAt)) {
            throw new InvalidCredentialsException("Session token has expired");
        }

        return new AuthenticatedUser(userId, username, expiresAt);
    }

    private static String extractRawToken(String tokenOrAuthorizationHeader) {
        if (tokenOrAuthorizationHeader == null || tokenOrAuthorizationHeader.isBlank()) {
            throw new InvalidCredentialsException("Authentication token is required");
        }
        String trimmed = tokenOrAuthorizationHeader.trim();
        if (trimmed.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
            String stripped = trimmed.substring(BEARER_PREFIX.length()).trim();
            if (stripped.isEmpty()) {
                throw new InvalidCredentialsException("Authentication token is required");
            }
            return stripped;
        }
        return trimmed;
    }

    private String sign(String data) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secretBytes, HMAC_ALGORITHM));
            byte[] rawHmac = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(rawHmac);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("Failed to compute HMAC-SHA256 signature", ex);
        }
    }

    public record AuthenticatedUser(UUID userId, String username, Instant expiresAt) {
    }
}
