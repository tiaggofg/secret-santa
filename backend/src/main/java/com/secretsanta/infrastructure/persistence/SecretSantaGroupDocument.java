package com.secretsanta.infrastructure.persistence;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "secret_santa_groups")
public class SecretSantaGroupDocument {

    @Id
    private String id;

    @Indexed(unique = true)
    private String publicSlug;

    private String eventName;

    @Indexed
    private String organizerUserId;

    private String status;

    private boolean geographicRestrictionRelaxed;

    private Instant createdAt;

    private Instant drawnAt;

    @Version
    private Long version;

    private List<ParticipantSubDocument> participants = new ArrayList<>();

    public SecretSantaGroupDocument() {
    }

    public SecretSantaGroupDocument(
            String id,
            String publicSlug,
            String eventName,
            String organizerUserId,
            String status,
            boolean geographicRestrictionRelaxed,
            Instant createdAt,
            Instant drawnAt,
            Long version,
            List<ParticipantSubDocument> participants) {
        this.id = id;
        this.publicSlug = publicSlug;
        this.eventName = eventName;
        this.organizerUserId = organizerUserId;
        this.status = status;
        this.geographicRestrictionRelaxed = geographicRestrictionRelaxed;
        this.createdAt = createdAt;
        this.drawnAt = drawnAt;
        this.version = version;
        this.participants = participants != null ? new ArrayList<>(participants) : new ArrayList<>();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getPublicSlug() {
        return publicSlug;
    }

    public void setPublicSlug(String publicSlug) {
        this.publicSlug = publicSlug;
    }

    public String getEventName() {
        return eventName;
    }

    public void setEventName(String eventName) {
        this.eventName = eventName;
    }

    public String getOrganizerUserId() {
        return organizerUserId;
    }

    public void setOrganizerUserId(String organizerUserId) {
        this.organizerUserId = organizerUserId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public boolean isGeographicRestrictionRelaxed() {
        return geographicRestrictionRelaxed;
    }

    public void setGeographicRestrictionRelaxed(boolean geographicRestrictionRelaxed) {
        this.geographicRestrictionRelaxed = geographicRestrictionRelaxed;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getDrawnAt() {
        return drawnAt;
    }

    public void setDrawnAt(Instant drawnAt) {
        this.drawnAt = drawnAt;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }

    public List<ParticipantSubDocument> getParticipants() {
        return participants;
    }

    public void setParticipants(List<ParticipantSubDocument> participants) {
        this.participants = participants;
    }
}
