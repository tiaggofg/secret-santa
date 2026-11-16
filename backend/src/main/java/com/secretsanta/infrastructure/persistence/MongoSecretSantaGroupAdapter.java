package com.secretsanta.infrastructure.persistence;

import com.secretsanta.domain.model.GeoCoordinates;
import com.secretsanta.domain.model.GroupStatus;
import com.secretsanta.domain.model.InviteSignature;
import com.secretsanta.domain.model.Participant;
import com.secretsanta.domain.model.ParticipantName;
import com.secretsanta.domain.model.SecretSantaGroup;
import com.secretsanta.domain.model.Username;
import com.secretsanta.domain.port.SecretSantaGroupRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;

@Repository
public class MongoSecretSantaGroupAdapter implements SecretSantaGroupRepository {

    private static final Sort CREATED_AT_DESC = Sort.by(Sort.Direction.DESC, "createdAt");

    private final SpringDataSecretSantaGroupMongoRepository repository;

    public MongoSecretSantaGroupAdapter(SpringDataSecretSantaGroupMongoRepository repository) {
        this.repository = repository;
    }

    @Override
    public SecretSantaGroup save(SecretSantaGroup group) {
        SecretSantaGroupDocument doc = toDocument(group);
        SecretSantaGroupDocument saved = repository.save(doc);
        return toDomain(saved);
    }

    @Override
    public Optional<SecretSantaGroup> findById(UUID id) {
        return repository.findById(id.toString()).map(MongoSecretSantaGroupAdapter::toDomain);
    }

    @Override
    public List<SecretSantaGroup> findByUserParticipationOrOrganizationOrderByCreatedAtDesc(UUID userId) {
        return repository.findByOrganizerOrParticipantOrderByCreatedAtDesc(userId.toString(), CREATED_AT_DESC)
                .stream()
                .map(MongoSecretSantaGroupAdapter::toDomain)
                .toList();
    }

    public static SecretSantaGroupDocument toDocument(SecretSantaGroup group) {
        List<ParticipantSubDocument> participantDocs = group.participants()
                .stream()
                .map(MongoSecretSantaGroupAdapter::toSubDocument)
                .toList();

        return new SecretSantaGroupDocument(
                group.id().toString(),
                group.eventName(),
                group.inviteSignature().value(),
                group.organizerUserId().toString(),
                group.status().name(),
                group.geographicRestrictionRelaxed(),
                group.createdAt(),
                group.drawnAt(),
                group.version(),
                participantDocs);
    }

    public static SecretSantaGroup toDomain(SecretSantaGroupDocument doc) {
        List<Participant> participants = doc.getParticipants() == null
                ? List.of()
                : doc.getParticipants().stream().map(MongoSecretSantaGroupAdapter::toDomainParticipant).toList();

        return SecretSantaGroup.reconstitute(
                UUID.fromString(doc.getId()),
                doc.getEventName(),
                new InviteSignature(doc.getInviteSignature()),
                UUID.fromString(doc.getOrganizerUserId()),
                GroupStatus.valueOf(doc.getStatus()),
                doc.isGeographicRestrictionRelaxed(),
                doc.getCreatedAt(),
                doc.getDrawnAt(),
                doc.getVersion(),
                participants);
    }

    private static ParticipantSubDocument toSubDocument(Participant p) {
        Double lat = p.coordinates() != null ? p.coordinates().latitude() : null;
        Double lon = p.coordinates() != null ? p.coordinates().longitude() : null;
        return new ParticipantSubDocument(
                p.id().toString(),
                p.userId().toString(),
                p.name().value(),
                p.username().value(),
                lat,
                lon,
                p.householdClusterId() != null ? p.householdClusterId().toString() : null,
                p.drawnParticipantId() != null ? p.drawnParticipantId().toString() : null,
                p.revealedAt(),
                p.createdAt());
    }

    private static Participant toDomainParticipant(ParticipantSubDocument sub) {
        GeoCoordinates coords = (sub.getLatitude() != null && sub.getLongitude() != null)
                ? new GeoCoordinates(sub.getLatitude(), sub.getLongitude())
                : null;
        return Participant.reconstitute(
                UUID.fromString(sub.getId()),
                UUID.fromString(sub.getUserId()),
                new ParticipantName(sub.getName()),
                new Username(sub.getUsername()),
                coords,
                sub.getHouseholdClusterId() != null ? UUID.fromString(sub.getHouseholdClusterId()) : null,
                sub.getDrawnParticipantId() != null ? UUID.fromString(sub.getDrawnParticipantId()) : null,
                sub.getRevealedAt(),
                sub.getCreatedAt());
    }
}
