package com.secretsanta.domain.exception;

public class DuplicateParticipantException extends RuntimeException {
    public DuplicateParticipantException(String message) {
        super(message);
    }
}
