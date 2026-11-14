package com.secretsanta.domain.model;

import com.secretsanta.domain.exception.DomainValidationException;

public record PasswordResetTokenHash(String value) {

    public PasswordResetTokenHash {
        if (value == null || value.isBlank()) {
            throw new DomainValidationException("PasswordResetTokenHash must not be blank");
        }
    }

    @Override
    public String toString() {
        return "PasswordResetTokenHash[PROTECTED]";
    }
}
