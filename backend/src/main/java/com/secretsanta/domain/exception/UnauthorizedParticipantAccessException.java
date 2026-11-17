package com.secretsanta.domain.exception;

public class UnauthorizedParticipantAccessException extends RuntimeException {
    public UnauthorizedParticipantAccessException(String message) {
        super(message);
    }
}
