package com.secretsanta.infrastructure.persistence;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import jakarta.annotation.PostConstruct;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexOperations;
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
        IndexOperations userIndexOps = mongoTemplate.indexOps(UserAccountDocument.class);
        ensureIndex(userIndexOps, new Index().on("username", Sort.Direction.ASC).named("username").unique());
        ensureIndex(userIndexOps, new Index().on("resetTokenHash", Sort.Direction.ASC).named("resetTokenHash"));

        IndexOperations groupIndexOps = mongoTemplate.indexOps(SecretSantaGroupDocument.class);
        if (groupIndexOps.getIndexInfo().stream().anyMatch(index -> "publicSlug".equals(index.getName()))) {
            groupIndexOps.dropIndex("publicSlug");
        }
        ensureIndex(groupIndexOps, new Index().on("organizerUserId", Sort.Direction.ASC).named("organizerUserId"));
        ensureIndex(groupIndexOps, new Index().on("participants.userId", Sort.Direction.ASC).named("participants_userId"));
    }

    private static void ensureIndex(IndexOperations indexOps, Index index) {
        try {
            indexOps.createIndex(index);
        } catch (DataIntegrityViolationException ex) {
            if (ex.getMessage() == null || !ex.getMessage().contains("IndexOptionsConflict")) {
                throw ex;
            }
        }
    }

    @RollbackExecution
    public void rollback() {
        // Indexes are idempotent
    }
}
