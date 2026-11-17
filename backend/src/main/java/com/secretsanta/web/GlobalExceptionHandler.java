package com.secretsanta.web;

import com.secretsanta.application.AlreadyParticipantAuthenticatedException;
import com.secretsanta.domain.exception.DomainValidationException;
import com.secretsanta.domain.exception.DuplicateParticipantException;
import com.secretsanta.domain.exception.DuplicateUsernameException;
import com.secretsanta.domain.exception.GroupAlreadyDrawnException;
import com.secretsanta.domain.exception.GroupNotDrawnYetException;
import com.secretsanta.domain.exception.InsufficientParticipantsForDrawException;
import com.secretsanta.domain.exception.InvalidCredentialsException;
import com.secretsanta.domain.exception.InvalidInviteSignatureException;
import com.secretsanta.domain.exception.InvalidPasswordResetTokenException;
import com.secretsanta.domain.exception.InvalidRevealPasswordException;
import com.secretsanta.domain.exception.ResourceNotFoundException;
import com.secretsanta.domain.exception.UnauthorizedOrganizerAccessException;
import com.secretsanta.domain.exception.UnauthorizedParticipantAccessException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.net.URI;
import java.time.Instant;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private final AuthCookieManager cookieManager;

    public GlobalExceptionHandler() {
        this.cookieManager = null;
    }

    @Autowired
    public GlobalExceptionHandler(AuthCookieManager cookieManager) {
        this.cookieManager = cookieManager;
    }

    @ExceptionHandler(DomainValidationException.class)
    public ProblemDetail handleDomainValidation(DomainValidationException ex) {
        return buildProblem(HttpStatus.BAD_REQUEST, "Validation Error", ex.getMessage(), "VALIDATION_ERROR");
    }

    @ExceptionHandler(InvalidPasswordResetTokenException.class)
    public ProblemDetail handleInvalidPasswordResetToken(InvalidPasswordResetTokenException ex) {
        return buildProblem(
                HttpStatus.BAD_REQUEST,
                "Invalid Password Reset Token",
                ex.getMessage(),
                "INVALID_RESET_TOKEN");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleMethodArgumentNotValid(MethodArgumentNotValidException ex) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
                .map(GlobalExceptionHandler::formatFieldError)
                .collect(Collectors.joining("; "));
        if (detail.isBlank()) {
            detail = "Invalid request payload";
        }
        return buildProblem(HttpStatus.BAD_REQUEST, "Validation Error", detail, "VALIDATION_ERROR");
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail handleHttpMessageNotReadable(HttpMessageNotReadableException ex) {
        return buildProblem(
                HttpStatus.BAD_REQUEST,
                "Malformed Request Body",
                "Request body is missing or malformed",
                "MALFORMED_REQUEST");
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ProblemDetail handleMissingRequestHeader(MissingRequestHeaderException ex) {
        if ("Authorization".equalsIgnoreCase(ex.getHeaderName())) {
            return buildProblem(
                    HttpStatus.UNAUTHORIZED,
                    "Unauthorized",
                    "Missing Authorization header",
                    "UNAUTHORIZED");
        }
        return buildProblem(
                HttpStatus.BAD_REQUEST,
                "Missing Header",
                ex.getMessage(),
                "MISSING_HEADER");
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ProblemDetail handleInvalidCredentials(InvalidCredentialsException ex) {
        return buildProblem(HttpStatus.UNAUTHORIZED, "Unauthorized", ex.getMessage(), "INVALID_CREDENTIALS");
    }

    @ExceptionHandler(InvalidRevealPasswordException.class)
    public ProblemDetail handleInvalidRevealPassword(InvalidRevealPasswordException ex) {
        return buildProblem(HttpStatus.UNAUTHORIZED, "Unauthorized", ex.getMessage(), "INVALID_PASSWORD");
    }

    @ExceptionHandler(InvalidInviteSignatureException.class)
    public ProblemDetail handleInvalidInviteSignature(InvalidInviteSignatureException ex) {
        return buildProblem(HttpStatus.FORBIDDEN, "Forbidden", ex.getMessage(), "INVALID_INVITE_SIGNATURE");
    }

    @ExceptionHandler(UnauthorizedOrganizerAccessException.class)
    public ProblemDetail handleUnauthorizedOrganizerAccess(UnauthorizedOrganizerAccessException ex) {
        return buildProblem(
                HttpStatus.FORBIDDEN,
                "Forbidden",
                ex.getMessage(),
                "FORBIDDEN_ORGANIZER_ACCESS");
    }

    @ExceptionHandler(UnauthorizedParticipantAccessException.class)
    public ProblemDetail handleUnauthorizedParticipantAccess(UnauthorizedParticipantAccessException ex) {
        return buildProblem(
                HttpStatus.FORBIDDEN,
                "Forbidden",
                ex.getMessage(),
                "FORBIDDEN_PARTICIPANT_ACCESS");
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleResourceNotFound(ResourceNotFoundException ex) {
        return buildProblem(HttpStatus.NOT_FOUND, "Resource Not Found", ex.getMessage(), "RESOURCE_NOT_FOUND");
    }

    @ExceptionHandler(AlreadyParticipantAuthenticatedException.class)
    public ProblemDetail handleAlreadyParticipantAuthenticated(
            AlreadyParticipantAuthenticatedException ex,
            HttpServletRequest request,
            HttpServletResponse response) {
        if (cookieManager != null) {
            cookieManager.setAuthCookies(response, request, ex.accessToken(), ex.refreshToken());
        }
        ProblemDetail problem = buildProblem(
                HttpStatus.CONFLICT,
                "Already Participant",
                ex.getMessage(),
                "ALREADY_PARTICIPANT");
        problem.setProperty("userId", ex.userId().toString());
        problem.setProperty("name", ex.name());
        problem.setProperty("username", ex.username());
        problem.setProperty("groupId", ex.groupId().toString());
        problem.setProperty("redirectPath", "/g/" + ex.groupId());
        return problem;
    }

    @ExceptionHandler(DuplicateParticipantException.class)
    public ProblemDetail handleDuplicateParticipant(DuplicateParticipantException ex) {
        return buildProblem(HttpStatus.CONFLICT, "Already Participant", ex.getMessage(), "ALREADY_PARTICIPANT");
    }

    @ExceptionHandler({
        DuplicateUsernameException.class,
        GroupAlreadyDrawnException.class,
        GroupNotDrawnYetException.class,
        DuplicateKeyException.class,
        OptimisticLockingFailureException.class
    })
    public ProblemDetail handleConflict(RuntimeException ex) {
        return buildProblem(HttpStatus.CONFLICT, "Conflict", ex.getMessage(), "CONFLICT");
    }

    @ExceptionHandler(InsufficientParticipantsForDrawException.class)
    public ProblemDetail handleInsufficientParticipants(InsufficientParticipantsForDrawException ex) {
        return buildProblem(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "Unprocessable Entity",
                ex.getMessage(),
                "INSUFFICIENT_PARTICIPANTS");
    }

    private static String formatFieldError(FieldError error) {
        return error.getField() + ": " + error.getDefaultMessage();
    }

    private static ProblemDetail buildProblem(
            HttpStatus status,
            String title,
            String detail,
            String errorCode) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                status,
                detail != null ? detail : status.getReasonPhrase());
        problem.setTitle(title);
        problem.setType(URI.create("https://secretsanta.local/problems/" + errorCode.toLowerCase().replace('_', '-')));
        problem.setProperty("errorCode", errorCode);
        problem.setProperty("message", detail != null ? detail : title);
        problem.setProperty("timestamp", Instant.now().toString());
        return problem;
    }
}
