package com.secretsanta.infrastructure.persistence;

import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface SpringDataUserAccountMongoRepository extends MongoRepository<UserAccountDocument, String> {

    Optional<UserAccountDocument> findByUsername(String username);

    Optional<UserAccountDocument> findByResetTokenHash(String resetTokenHash);

    boolean existsByUsername(String username);
}
