package com.secretsanta.domain.exception;

public class GroupAlreadyDrawnException extends RuntimeException {
    public GroupAlreadyDrawnException(String message) {
        super(message);
    }
}
