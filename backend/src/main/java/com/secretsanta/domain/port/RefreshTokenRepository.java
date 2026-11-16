package com.secretsanta.domain.port;

import com.secretsanta.domain.model.RefreshToken;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository {

    RefreshToken save(RefreshToken token);

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    void revokeFamily(UUID familyId, Instant revokedAt);

    void revokeAllByUserId(UUID userId, Instant revokedAt);
}
