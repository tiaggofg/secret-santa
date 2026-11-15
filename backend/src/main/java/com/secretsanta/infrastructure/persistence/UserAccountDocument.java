package com.secretsanta.infrastructure.persistence;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "users")
public class UserAccountDocument {

    @Id
    private String id;

    private String name;

    private String normalizedName;

    @Indexed(name = "username", unique = true)
    private String username;

    private String pinHash;

    @Indexed(name = "resetTokenHash")
    private String resetTokenHash;

    private Instant resetTokenExpiresAt;

    private Instant createdAt;

    @Version
    private Long version;

    public UserAccountDocument() {
    }

    public UserAccountDocument(
            String id,
            String name,
            String normalizedName,
            String username,
            String pinHash,
            String resetTokenHash,
            Instant resetTokenExpiresAt,
            Instant createdAt,
            Long version) {
        this.id = id;
        this.name = name;
        this.normalizedName = normalizedName;
        this.username = username;
        this.pinHash = pinHash;
        this.resetTokenHash = resetTokenHash;
        this.resetTokenExpiresAt = resetTokenExpiresAt;
        this.createdAt = createdAt;
        this.version = version;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getNormalizedName() {
        return normalizedName;
    }

    public void setNormalizedName(String normalizedName) {
        this.normalizedName = normalizedName;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPinHash() {
        return pinHash;
    }

    public void setPinHash(String pinHash) {
        this.pinHash = pinHash;
    }

    public String getResetTokenHash() {
        return resetTokenHash;
    }

    public void setResetTokenHash(String resetTokenHash) {
        this.resetTokenHash = resetTokenHash;
    }

    public Instant getResetTokenExpiresAt() {
        return resetTokenExpiresAt;
    }

    public void setResetTokenExpiresAt(Instant resetTokenExpiresAt) {
        this.resetTokenExpiresAt = resetTokenExpiresAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }
}
