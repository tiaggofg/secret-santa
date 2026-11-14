package com.secretsanta.domain.model;

import com.secretsanta.domain.exception.DomainValidationException;
import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

public record GroupSlug(String value) {

    private static final Pattern SLUG_PATTERN = Pattern.compile("^[a-z0-9]+(?:-[a-z0-9]+)*$");

    public GroupSlug {
        if (value == null) {
            throw new DomainValidationException("Group slug must not be null");
        }
        value = value.trim().toLowerCase(Locale.ROOT);
        if (value.length() < 3 || value.length() > 120 || !SLUG_PATTERN.matcher(value).matches()) {
            throw new DomainValidationException("Group slug must be a valid URL-safe slug (3..120 chars)");
        }
    }

    public static GroupSlug fromEventNameAndSuffix(String eventName, String suffix) {
        if (eventName == null || eventName.isBlank()) {
            throw new DomainValidationException("Event name must not be blank");
        }
        String normalized = Normalizer.normalize(eventName.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        if (normalized.isEmpty()) {
            normalized = "grupo";
        }
        if (normalized.length() > 80) {
            normalized = normalized.substring(0, 80).replaceAll("-+$", "");
        }
        String cleanSuffix = suffix == null ? "" : suffix.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        String candidate = cleanSuffix.isEmpty() ? normalized : normalized + "-" + cleanSuffix;
        return new GroupSlug(candidate);
    }
}
