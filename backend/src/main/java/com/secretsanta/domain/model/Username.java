package com.secretsanta.domain.model;

import com.secretsanta.domain.exception.DomainValidationException;
import java.util.Locale;
import java.util.regex.Pattern;

public record Username(String value) {

    private static final Pattern VALID_PATTERN = Pattern.compile("^[a-z0-9._-]{3,30}$");

    public Username {
        if (value == null) {
            throw new DomainValidationException("Username must not be null");
        }
        value = value.trim().toLowerCase(Locale.ROOT);
        if (!VALID_PATTERN.matcher(value).matches()) {
            throw new DomainValidationException(
                    "Username must be 3 to 30 characters containing only lowercase letters, digits, '.', '_' or '-'");
        }
    }
}
