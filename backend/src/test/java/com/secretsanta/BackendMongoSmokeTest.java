package com.secretsanta;

import static org.assertj.core.api.Assertions.assertThat;

import com.secretsanta.config.MongoTestContainerConfig;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.ContextConfiguration;

@SpringBootTest
@ContextConfiguration(initializers = MongoTestContainerConfig.class)
class BackendMongoSmokeTest {

    @Autowired
    private MongoTemplate mongoTemplate;

    @Test
    void shouldLoadContextAndExecuteMongoRoundTrip() {
        assertThat(mongoTemplate).isNotNull();

        Document doc = new Document("_id", "smoke-1").append("status", "OK");
        mongoTemplate.save(doc, "smoke_checks");

        Document loaded = mongoTemplate.findById("smoke-1", Document.class, "smoke_checks");
        assertThat(loaded).isNotNull();
        assertThat(loaded.getString("status")).isEqualTo("OK");

        mongoTemplate.dropCollection("smoke_checks");
    }
}
