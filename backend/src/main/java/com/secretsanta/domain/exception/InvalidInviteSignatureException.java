package com.secretsanta.domain.exception;

public class InvalidInviteSignatureException extends RuntimeException {
    public InvalidInviteSignatureException(String message) {
        super(message);
    }
}
