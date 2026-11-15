package com.secretsanta.infrastructure.persistence;

import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

public interface SpringDataSecretSantaGroupMongoRepository
        extends MongoRepository<SecretSantaGroupDocument, String> {

    @Query("{ '$or': [ { 'organizerUserId': ?0 }, { 'participants.userId': ?0 } ] }")
    List<SecretSantaGroupDocument> findByOrganizerOrParticipantOrderByCreatedAtDesc(String userId, Sort sort);
}
