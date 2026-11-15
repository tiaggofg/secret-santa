package com.secretsanta.domain.port;

import com.secretsanta.domain.model.SecretSantaGroup;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SecretSantaGroupRepository {

    SecretSantaGroup save(SecretSantaGroup group);

    Optional<SecretSantaGroup> findById(UUID id);

    List<SecretSantaGroup> findByUserParticipationOrOrganizationOrderByCreatedAtDesc(UUID userId);
}
