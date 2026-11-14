package com.secretsanta.infrastructure.persistence;

import com.secretsanta.domain.model.ParticipantName;
import com.secretsanta.domain.model.PasswordResetTokenHash;
import com.secretsanta.domain.model.PinHash;
import com.secretsanta.domain.model.UserAccount;
import com.secretsanta.domain.model.Username;
import com.secretsanta.domain.port.UserAccountRepository;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class MongoUserAccountAdapter implements UserAccountRepository {

    private final SpringDataUserAccountMongoRepository repository;

    public MongoUserAccountAdapter(SpringDataUserAccountMongoRepository repository) {
        this.repository = repository;
    }

    @Override
    public UserAccount save(UserAccount userAccount) {
        UserAccountDocument doc = toDocument(userAccount);
        UserAccountDocument saved = repository.save(doc);
        return toDomain(saved);
    }

    @Override
    public Optional<UserAccount> findById(UUID id) {
        return repository.findById(id.toString()).map(MongoUserAccountAdapter::toDomain);
    }

    @Override
    public Optional<UserAccount> findByUsername(Username username) {
        return repository.findByUsername(username.value()).map(MongoUserAccountAdapter::toDomain);
    }

    @Override
    public Optional<UserAccount> findByResetTokenHash(PasswordResetTokenHash resetTokenHash) {
        return repository.findByResetTokenHash(resetTokenHash.value()).map(MongoUserAccountAdapter::toDomain);
    }

    @Override
    public boolean existsByUsername(Username username) {
        return repository.existsByUsername(username.value());
    }

    public static UserAccountDocument toDocument(UserAccount domain) {
        return new UserAccountDocument(
                domain.id().toString(),
                domain.name().value(),
                domain.name().normalizedKey(),
                domain.username().value(),
                domain.pinHash().value(),
                domain.resetTokenHash() != null ? domain.resetTokenHash().value() : null,
                domain.resetTokenExpiresAt(),
                domain.createdAt(),
                domain.version());
    }

    public static UserAccount toDomain(UserAccountDocument doc) {
        return UserAccount.reconstitute(
                UUID.fromString(doc.getId()),
                new ParticipantName(doc.getName()),
                new Username(doc.getUsername()),
                new PinHash(doc.getPinHash()),
                doc.getResetTokenHash() != null ? new PasswordResetTokenHash(doc.getResetTokenHash()) : null,
                doc.getResetTokenExpiresAt(),
                doc.getCreatedAt(),
                doc.getVersion());
    }
}
