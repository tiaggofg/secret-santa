package com.secretsanta.domain.exception;

public class InvalidRevealPasswordException extends RuntimeException {
    public InvalidRevealPasswordException(String message) {
        super(message);
    }
}
