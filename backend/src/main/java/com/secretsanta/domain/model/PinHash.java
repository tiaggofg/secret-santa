package com.secretsanta.domain.model;

import com.secretsanta.domain.exception.DomainValidationException;

public record PinHash(String value) {

    public PinHash {
        if (value == null || value.isBlank()) {
            throw new DomainValidationException("PinHash must not be blank");
        }
    }

    @Override
    public String toString() {
        return "PinHash[PROTECTED]";
    }
}
