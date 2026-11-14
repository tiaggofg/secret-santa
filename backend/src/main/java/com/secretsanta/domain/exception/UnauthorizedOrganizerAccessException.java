package com.secretsanta.domain.exception;

public class UnauthorizedOrganizerAccessException extends RuntimeException {
    public UnauthorizedOrganizerAccessException(String message) {
        super(message);
    }
}
