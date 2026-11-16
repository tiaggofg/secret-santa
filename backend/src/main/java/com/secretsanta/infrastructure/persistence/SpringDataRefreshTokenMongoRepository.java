package com.secretsanta.infrastructure.persistence;

import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface SpringDataRefreshTokenMongoRepository extends MongoRepository<RefreshTokenDocument, String> {

    Optional<RefreshTokenDocument> findByTokenHash(String tokenHash);
}
