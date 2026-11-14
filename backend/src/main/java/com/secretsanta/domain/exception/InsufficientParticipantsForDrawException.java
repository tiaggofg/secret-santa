package com.secretsanta.domain.exception;

public class InsufficientParticipantsForDrawException extends RuntimeException {
    public InsufficientParticipantsForDrawException(String message) {
        super(message);
    }
}
