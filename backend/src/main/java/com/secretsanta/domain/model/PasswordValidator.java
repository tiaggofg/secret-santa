package com.secretsanta.domain.model;

import com.secretsanta.domain.exception.DomainValidationException;

public final class PasswordValidator {

    public static final int MIN_LENGTH = 6;
    public static final int MAX_LENGTH = 64;

    private PasswordValidator() {
    }

    public static void validateRawPassword(String rawPassword) {
        if (rawPassword == null || rawPassword.length() < MIN_LENGTH || rawPassword.length() > MAX_LENGTH) {
            throw new DomainValidationException(
                    "Password must be between " + MIN_LENGTH + " and " + MAX_LENGTH + " characters");
        }

        boolean hasUpper = false;
        boolean hasLower = false;
        boolean hasDigit = false;
        boolean hasSpecial = false;

        for (int i = 0; i < rawPassword.length(); i++) {
            char ch = rawPassword.charAt(i);
            if (Character.isWhitespace(ch)) {
                throw new DomainValidationException("Password must not contain whitespace");
            }
            if (Character.isUpperCase(ch)) {
                hasUpper = true;
            } else if (Character.isLowerCase(ch)) {
                hasLower = true;
            } else if (Character.isDigit(ch)) {
                hasDigit = true;
            } else {
                hasSpecial = true;
            }
        }

        if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
            throw new DomainValidationException(
                    "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character");
        }
    }
}
