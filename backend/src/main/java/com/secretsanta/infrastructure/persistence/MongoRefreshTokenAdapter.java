package com.secretsanta.infrastructure.persistence;

import com.secretsanta.domain.model.RefreshToken;
import com.secretsanta.domain.port.RefreshTokenRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

@Repository
public class MongoRefreshTokenAdapter implements RefreshTokenRepository {

    private final SpringDataRefreshTokenMongoRepository springDataRepository;
    private final MongoTemplate mongoTemplate;

    public MongoRefreshTokenAdapter(
            SpringDataRefreshTokenMongoRepository springDataRepository,
            MongoTemplate mongoTemplate) {
        this.springDataRepository = springDataRepository;
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public RefreshToken save(RefreshToken token) {
        RefreshTokenDocument saved = springDataRepository.save(toDocument(token));
        return toDomain(saved);
    }

    @Override
    public Optional<RefreshToken> findByTokenHash(String tokenHash) {
        return springDataRepository.findByTokenHash(tokenHash)
                .map(MongoRefreshTokenAdapter::toDomain);
    }

    @Override
    public void revokeFamily(UUID familyId, Instant revokedAt) {
        Query query = Query.query(
                Criteria.where("familyId").is(familyId.toString()).and("revokedAt").isNull());
        mongoTemplate.updateMulti(query, Update.update("revokedAt", revokedAt), RefreshTokenDocument.class);
    }

    @Override
    public void revokeAllByUserId(UUID userId, Instant revokedAt) {
        Query query = Query.query(
                Criteria.where("userId").is(userId.toString()).and("revokedAt").isNull());
        mongoTemplate.updateMulti(query, Update.update("revokedAt", revokedAt), RefreshTokenDocument.class);
    }

    private static RefreshTokenDocument toDocument(RefreshToken token) {
        return new RefreshTokenDocument(
                token.id().toString(),
                token.userId().toString(),
                token.familyId().toString(),
                token.tokenHash(),
                token.expiresAt(),
                token.revokedAt(),
                token.createdAt());
    }

    private static RefreshToken toDomain(RefreshTokenDocument doc) {
        return new RefreshToken(
                UUID.fromString(doc.getId()),
                UUID.fromString(doc.getUserId()),
                UUID.fromString(doc.getFamilyId()),
                doc.getTokenHash(),
                doc.getExpiresAt(),
                doc.getRevokedAt(),
                doc.getCreatedAt());
    }
}
