package com.secretsanta.domain.port;

import com.secretsanta.domain.model.PasswordResetTokenHash;
import com.secretsanta.domain.model.UserAccount;
import com.secretsanta.domain.model.Username;
import java.util.Optional;
import java.util.UUID;

public interface UserAccountRepository {

    UserAccount save(UserAccount userAccount);

    Optional<UserAccount> findById(UUID id);

    Optional<UserAccount> findByUsername(Username username);

    Optional<UserAccount> findByResetTokenHash(PasswordResetTokenHash resetTokenHash);

    boolean existsByUsername(Username username);
}
