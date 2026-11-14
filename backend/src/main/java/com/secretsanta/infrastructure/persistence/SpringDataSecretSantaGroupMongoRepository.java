package com.secretsanta.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface SpringDataSecretSantaGroupMongoRepository
        extends MongoRepository<SecretSantaGroupDocument, String> {

    Optional<SecretSantaGroupDocument> findByPublicSlug(String publicSlug);

    boolean existsByPublicSlug(String publicSlug);

    List<SecretSantaGroupDocument> findAllByOrderByCreatedAtDesc();
}
