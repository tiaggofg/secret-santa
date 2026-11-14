package com.secretsanta.config;

import de.bwaldvogel.mongo.MongoServer;
import de.bwaldvogel.mongo.MongoVersion;
import de.bwaldvogel.mongo.backend.memory.MemoryBackend;
import java.net.InetSocketAddress;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.event.ContextClosedEvent;
import org.springframework.test.context.support.TestPropertySourceUtils;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

public class MongoTestContainerConfig
        implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    private static final Logger log = LoggerFactory.getLogger(MongoTestContainerConfig.class);

    private static volatile String sharedMongoUri;
    private static MongoDBContainer mongoDBContainer;
    private static MongoServer inMemoryMongoServer;

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        String uri = ensureMongoStarted();
        TestPropertySourceUtils.addInlinedPropertiesToEnvironment(
                applicationContext,
                "spring.data.mongodb.uri=" + uri,
                "spring.data.mongodb.auto-index-creation=true");
        applicationContext.addApplicationListener(event -> {
            if (event instanceof ContextClosedEvent) {
                log.debug("Application context closed for Mongo test environment");
            }
        });
    }

    private static synchronized String ensureMongoStarted() {
        if (sharedMongoUri != null) {
            return sharedMongoUri;
        }
        if (isDockerAvailable()) {
            try {
                mongoDBContainer = new MongoDBContainer(DockerImageName.parse("mongo:7.0"));
                mongoDBContainer.start();
                sharedMongoUri = mongoDBContainer.getReplicaSetUrl("secret_santa_test");
                log.info("Started Testcontainers MongoDB at {}", sharedMongoUri);
                return sharedMongoUri;
            } catch (Throwable ex) {
                log.warn("Testcontainers MongoDB failed to start ({}); falling back to mongo-java-server in-memory",
                        ex.getMessage());
            }
        } else {
            log.info("Docker environment unavailable; using mongo-java-server in-memory fallback");
        }

        MemoryBackend backend = new MemoryBackend();
        backend.version(new MongoVersion() {
            @Override
            public List<Integer> getVersionArray() {
                return List.of(5, 0, 0);
            }

            @Override
            public int getWireVersion() {
                return 13;
            }
        });
        inMemoryMongoServer = new MongoServer(backend);
        InetSocketAddress address = inMemoryMongoServer.bind();
        sharedMongoUri = String.format("mongodb://%s:%d/secret_santa_test",
                address.getHostString(), address.getPort());
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            if (inMemoryMongoServer != null) {
                inMemoryMongoServer.shutdownNow();
            }
        }));
        log.info("Started in-memory mongo-java-server at {}", sharedMongoUri);
        return sharedMongoUri;
    }

    private static boolean isDockerAvailable() {
        try {
            if (!new java.io.File("/var/run/docker.sock").canWrite()) {
                return false;
            }
            return DockerClientFactory.instance().isDockerAvailable();
        } catch (Throwable ex) {
            return false;
        }
    }
}
