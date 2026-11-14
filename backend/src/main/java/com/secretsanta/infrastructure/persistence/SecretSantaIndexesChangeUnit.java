package com.secretsanta.infrastructure.persistence;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import jakarta.annotation.PostConstruct;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Component
@ChangeUnit(id = "secret-santa-indexes-001", order = "001", author = "secretsanta")
public class SecretSantaIndexesChangeUnit {

    private final MongoTemplate mongoTemplate;

    public SecretSantaIndexesChangeUnit(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @PostConstruct
    @Execution
    public void ensureIndexes() {
        mongoTemplate.indexOps(UserAccountDocument.class)
                .createIndex(new Index().on("username", Sort.Direction.ASC).unique());
        mongoTemplate.indexOps(UserAccountDocument.class)
                .createIndex(new Index().on("resetTokenHash", Sort.Direction.ASC));
        mongoTemplate.indexOps(SecretSantaGroupDocument.class)
                .createIndex(new Index().on("publicSlug", Sort.Direction.ASC).unique());
        mongoTemplate.indexOps(SecretSantaGroupDocument.class)
                .createIndex(new Index().on("organizerUserId", Sort.Direction.ASC));
    }

    @RollbackExecution
    public void rollback() {
        // Indexes are idempotent
    }
}
