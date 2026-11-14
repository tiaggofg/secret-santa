package com.secretsanta.domain.model;

import com.secretsanta.domain.exception.DomainValidationException;
import java.util.Locale;

public record ParticipantName(String value) {

    public ParticipantName {
        if (value == null) {
            throw new DomainValidationException("Participant name must not be null");
        }
        value = value.trim();
        if (value.length() < 2 || value.length() > 60) {
            throw new DomainValidationException("Participant name must be between 2 and 60 characters");
        }
    }

    public String normalizedKey() {
        return value.toLowerCase(Locale.ROOT);
    }
}
