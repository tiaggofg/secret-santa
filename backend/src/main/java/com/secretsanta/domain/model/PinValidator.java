package com.secretsanta.domain.model;

import com.secretsanta.domain.exception.DomainValidationException;
import java.util.regex.Pattern;

public final class PinValidator {

    private static final Pattern NUMERIC_PIN_PATTERN = Pattern.compile("^\\d{4,6}$");

    private PinValidator() {
    }

    public static void validateRawPin(String rawPin) {
        if (rawPin == null || !NUMERIC_PIN_PATTERN.matcher(rawPin).matches()) {
            throw new DomainValidationException("PIN must consist exclusively of 4 to 6 numeric digits");
        }
    }
}
