package com.secretsanta.domain.model;

import com.secretsanta.domain.exception.DomainValidationException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.regex.Pattern;

public record InviteSignature(String value) {

    private static final Pattern URL_SAFE_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{16,128}$");

    public InviteSignature {
        if (value == null || value.isBlank()) {
            throw new DomainValidationException("InviteSignature must not be blank");
        }
        String trimmed = value.trim();
        if (!URL_SAFE_PATTERN.matcher(trimmed).matches()) {
            throw new DomainValidationException(
                    "InviteSignature must be a URL-safe string between 16 and 128 characters");
        }
        value = trimmed;
    }

    public boolean matchesConstantTime(String candidate) {
        if (candidate == null || candidate.isBlank()) {
            return false;
        }
        return MessageDigest.isEqual(
                this.value.getBytes(StandardCharsets.UTF_8),
                candidate.trim().getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public String toString() {
        return "InviteSignature[PROTECTED]";
    }
}
