package com.secretsanta.domain.model;

import com.secretsanta.domain.exception.DomainValidationException;
import com.secretsanta.domain.exception.DuplicateParticipantException;
import com.secretsanta.domain.exception.GroupAlreadyDrawnException;
import com.secretsanta.domain.exception.GroupNotDrawnYetException;
import com.secretsanta.domain.exception.InsufficientParticipantsForDrawException;
import com.secretsanta.domain.exception.ResourceNotFoundException;
import com.secretsanta.domain.exception.UnauthorizedOrganizerAccessException;
import com.secretsanta.domain.exception.UnauthorizedParticipantAccessException;
import com.secretsanta.domain.service.DerangementDrawService;
import com.secretsanta.domain.service.HouseholdClusterService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;

public final class SecretSantaGroup {

    public static final int MIN_PARTICIPANTS_FOR_DRAW = 3;

    private final UUID id;
    private final String eventName;
    private InviteSignature inviteSignature;
    private final UUID organizerUserId;
    private GroupStatus status;
    private boolean geographicRestrictionRelaxed;
    private final Instant createdAt;
    private Instant drawnAt;
    private final Long version;
    private final List<Participant> participants;

    private SecretSantaGroup(
            UUID id,
            String eventName,
            InviteSignature inviteSignature,
            UUID organizerUserId,
            GroupStatus status,
            boolean geographicRestrictionRelaxed,
            Instant createdAt,
            Instant drawnAt,
            Long version,
            List<Participant> participants) {
        this.id = Objects.requireNonNull(id, "id must not be null");
        this.eventName = validateEventName(eventName);
        this.inviteSignature = Objects.requireNonNull(inviteSignature, "inviteSignature must not be null");
        this.organizerUserId = Objects.requireNonNull(organizerUserId, "organizerUserId must not be null");
        this.status = Objects.requireNonNull(status, "status must not be null");
        this.geographicRestrictionRelaxed = geographicRestrictionRelaxed;
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt must not be null");
        this.drawnAt = drawnAt;
        this.version = version;
        this.participants = new ArrayList<>(Objects.requireNonNull(participants, "participants must not be null"));
    }

    public static SecretSantaGroup create(
            String eventName,
            InviteSignature inviteSignature,
            UUID organizerUserId,
            Instant now) {
        return create(UUID.randomUUID(), eventName, inviteSignature, organizerUserId, now);
    }

    public static SecretSantaGroup create(
            UUID id,
            String eventName,
            InviteSignature inviteSignature,
            UUID organizerUserId,
            Instant now) {
        return new SecretSantaGroup(
                id,
                eventName,
                inviteSignature,
                organizerUserId,
                GroupStatus.OPEN,
                false,
                now,
                null,
                null,
                List.of());
    }

    public static SecretSantaGroup reconstitute(
            UUID id,
            String eventName,
            InviteSignature inviteSignature,
            UUID organizerUserId,
            GroupStatus status,
            boolean geographicRestrictionRelaxed,
            Instant createdAt,
            Instant drawnAt,
            Long version,
            List<Participant> participants) {
        return new SecretSantaGroup(
                id,
                eventName,
                inviteSignature,
                organizerUserId,
                status,
                geographicRestrictionRelaxed,
                createdAt,
                drawnAt,
                version,
                participants);
    }

    private static String validateEventName(String eventName) {
        if (eventName == null) {
            throw new DomainValidationException("Event name must not be null");
        }
        String trimmed = eventName.trim();
        if (trimmed.length() < 3 || trimmed.length() > 100) {
            throw new DomainValidationException("Event name must be between 3 and 100 characters");
        }
        return trimmed;
    }

    public void assertOrganizer(UUID requesterUserId) {
        if (requesterUserId == null || !this.organizerUserId.equals(requesterUserId)) {
            throw new UnauthorizedOrganizerAccessException("Only the group organizer can perform this operation");
        }
    }

    public boolean isOrganizer(UUID userId) {
        return userId != null && this.organizerUserId.equals(userId);
    }

    public boolean hasParticipantWithUserId(UUID userId) {
        if (userId == null) {
            return false;
        }
        return participants.stream().anyMatch(p -> p.userId().equals(userId));
    }

    public Participant requireParticipantByUserId(UUID userId) {
        if (userId == null) {
            throw new UnauthorizedParticipantAccessException(
                    "Only registered participants of this group can perform this operation");
        }
        return participants.stream()
                .filter(p -> p.userId().equals(userId))
                .findFirst()
                .orElseThrow(() -> new UnauthorizedParticipantAccessException(
                        "Only registered participants of this group can perform this operation"));
    }

    public Participant registerParticipant(
            UUID userId,
            ParticipantName name,
            Username username,
            GeoCoordinates coordinates,
            Instant now) {
        if (this.status == GroupStatus.DRAWN) {
            throw new GroupAlreadyDrawnException("Cannot join a group after the draw has been executed");
        }
        boolean duplicate = participants.stream()
                .anyMatch(p -> p.userId().equals(userId) || p.username().equals(username));
        if (duplicate) {
            throw new DuplicateParticipantException("Participant is already registered in this group");
        }
        Participant participant = Participant.createNew(userId, name, username, coordinates, now);
        participants.add(participant);
        return participant;
    }

    public void removeParticipant(UUID participantId) {
        if (this.status == GroupStatus.DRAWN) {
            throw new GroupAlreadyDrawnException("Cannot remove a participant after the draw has been executed");
        }
        boolean removed = participants.removeIf(p -> p.id().equals(participantId));
        if (!removed) {
            throw new ResourceNotFoundException("Participant not found in group");
        }
    }

    public DrawResult executeDraw(
            HouseholdClusterService clusterService,
            DerangementDrawService drawService,
            Instant now) {
        Objects.requireNonNull(clusterService, "clusterService must not be null");
        Objects.requireNonNull(drawService, "drawService must not be null");
        return executeDraw(currentParticipants -> drawService.computeDraw(currentParticipants, clusterService), now);
    }

    public DrawResult executeDraw(Function<List<Participant>, DrawResult> drawStrategy, Instant now) {
        Objects.requireNonNull(drawStrategy, "drawStrategy must not be null");
        Objects.requireNonNull(now, "now must not be null");
        if (this.status == GroupStatus.DRAWN) {
            throw new GroupAlreadyDrawnException("Draw has already been executed for this group");
        }
        if (this.participants.size() < MIN_PARTICIPANTS_FOR_DRAW) {
            throw new InsufficientParticipantsForDrawException(
                    "At least 3 participants are required to execute the Secret Santa draw");
        }
        DrawResult result = drawStrategy.apply(Collections.unmodifiableList(this.participants));
        for (Participant participant : this.participants) {
            UUID clusterId = result.householdClusters().get(participant.id());
            UUID drawnId = result.assignments().get(participant.id());
            if (clusterId == null || drawnId == null) {
                throw new DomainValidationException("Incomplete draw result for participant " + participant.id());
            }
            if (participant.id().equals(drawnId)) {
                throw new DomainValidationException("Self-draw is forbidden");
            }
            participant.assignDrawOutcome(clusterId, drawnId);
        }
        this.status = GroupStatus.DRAWN;
        this.geographicRestrictionRelaxed = result.geographicRestrictionRelaxed();
        this.drawnAt = now;
        return result;
    }

    public Participant findParticipantByUsername(Username username) {
        return participants.stream()
                .filter(p -> p.username().equals(username))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Participant not found with username " + username.value()));
    }

    public Participant findParticipantById(UUID participantId) {
        return participants.stream()
                .filter(p -> p.id().equals(participantId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Participant not found in group"));
    }

    public String markRevealedAndGetDrawnName(UUID participantId, Instant now) {
        if (this.status != GroupStatus.DRAWN) {
            throw new GroupNotDrawnYetException("The Secret Santa draw has not been executed yet");
        }
        Participant participant = findParticipantById(participantId);
        participant.markRevealed(now);
        Participant drawn = findParticipantById(participant.drawnParticipantId());
        return drawn.name().value();
    }

    public void rotateInviteSignature(InviteSignature newInviteSignature) {
        this.inviteSignature = Objects.requireNonNull(newInviteSignature, "inviteSignature must not be null");
    }

    public UUID id() {
        return id;
    }

    public InviteSignature inviteSignature() {
        return inviteSignature;
    }

    public String eventName() {
        return eventName;
    }

    public UUID organizerUserId() {
        return organizerUserId;
    }

    public GroupStatus status() {
        return status;
    }

    public boolean geographicRestrictionRelaxed() {
        return geographicRestrictionRelaxed;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant drawnAt() {
        return drawnAt;
    }

    public Long version() {
        return version;
    }

    public List<Participant> participants() {
        return Collections.unmodifiableList(participants);
    }
}
