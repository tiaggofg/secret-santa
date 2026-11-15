package com.secretsanta.domain.exception;

public class InvalidGroupPinException extends RuntimeException {
    public InvalidGroupPinException(String message) {
        super(message);
    }
}
