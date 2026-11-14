package com.secretsanta.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.secretsanta.domain.exception.DomainValidationException;
import com.secretsanta.domain.exception.DuplicateParticipantException;
import com.secretsanta.domain.exception.DuplicateUsernameException;
import com.secretsanta.domain.exception.GroupAlreadyDrawnException;
import com.secretsanta.domain.exception.GroupNotDrawnYetException;
import com.secretsanta.domain.exception.InsufficientParticipantsForDrawException;
import com.secretsanta.domain.exception.InvalidCredentialsException;
import com.secretsanta.domain.exception.InvalidPasswordResetTokenException;
import com.secretsanta.domain.exception.ResourceNotFoundException;
import com.secretsanta.domain.exception.UnauthorizedOrganizerAccessException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.servlet.config.annotation.CorsRegistry;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void shouldMapDomainValidationExceptionToHttp400BadRequest() {
        ProblemDetail problem = handler.handleDomainValidation(
                new DomainValidationException("PIN must consist exclusively of 4 to 6 numeric digits"));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(problem.getTitle()).isEqualTo("Validation Error");
        assertThat(problem.getDetail()).contains("4 to 6 numeric digits");
        assertThat(problem.getProperties()).containsEntry("errorCode", "VALIDATION_ERROR");
        assertThat(problem.getProperties()).containsKey("timestamp");
    }

    @Test
    void shouldMapInvalidPasswordResetTokenExceptionToHttp400BadRequest() {
        ProblemDetail problem = handler.handleInvalidPasswordResetToken(
                new InvalidPasswordResetTokenException("Reset token has expired"));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        assertThat(problem.getTitle()).isEqualTo("Invalid Password Reset Token");
        assertThat(problem.getDetail()).isEqualTo("Reset token has expired");
        assertThat(problem.getProperties()).containsEntry("errorCode", "INVALID_RESET_TOKEN");
    }

    @Test
    void shouldMapInvalidCredentialsExceptionToHttp401Unauthorized() {
        ProblemDetail problem = handler.handleInvalidCredentials(
                new InvalidCredentialsException("Invalid username or PIN"));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        assertThat(problem.getTitle()).isEqualTo("Unauthorized");
        assertThat(problem.getDetail()).isEqualTo("Invalid username or PIN");
        assertThat(problem.getProperties()).containsEntry("errorCode", "INVALID_CREDENTIALS");
    }

    @Test
    void shouldMapUnauthorizedOrganizerAccessExceptionToHttp403Forbidden() {
        ProblemDetail problem = handler.handleUnauthorizedOrganizerAccess(
                new UnauthorizedOrganizerAccessException("Only the group organizer can perform this operation"));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.FORBIDDEN.value());
        assertThat(problem.getTitle()).isEqualTo("Forbidden");
        assertThat(problem.getDetail()).contains("group organizer");
        assertThat(problem.getProperties()).containsEntry("errorCode", "FORBIDDEN_ORGANIZER_ACCESS");
    }

    @Test
    void shouldMapResourceNotFoundExceptionToHttp404NotFound() {
        ProblemDetail problem = handler.handleResourceNotFound(
                new ResourceNotFoundException("Group not found: natal-inexistente"));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());
        assertThat(problem.getTitle()).isEqualTo("Resource Not Found");
        assertThat(problem.getDetail()).contains("natal-inexistente");
        assertThat(problem.getProperties()).containsEntry("errorCode", "RESOURCE_NOT_FOUND");
    }

    @Test
    void shouldMapDuplicateAndStateConflictExceptionsToHttp409Conflict() {
        ProblemDetail duplicateUser = handler.handleConflict(
                new DuplicateUsernameException("Username already taken"));
        ProblemDetail duplicateParticipant = handler.handleConflict(
                new DuplicateParticipantException("Participant already registered"));
        ProblemDetail alreadyDrawn = handler.handleConflict(
                new GroupAlreadyDrawnException("Draw already executed"));
        ProblemDetail notDrawnYet = handler.handleConflict(
                new GroupNotDrawnYetException("Draw not executed yet"));
        ProblemDetail duplicateKey = handler.handleConflict(
                new DuplicateKeyException("Duplicate key"));
        ProblemDetail optimisticLock = handler.handleConflict(
                new OptimisticLockingFailureException("Version conflict"));

        assertThat(duplicateUser.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(duplicateParticipant.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(alreadyDrawn.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(notDrawnYet.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(duplicateKey.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(optimisticLock.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(alreadyDrawn.getProperties()).containsEntry("errorCode", "CONFLICT");
    }

    @Test
    void shouldMapInsufficientParticipantsForDrawExceptionToHttp422UnprocessableEntity() {
        ProblemDetail problem = handler.handleInsufficientParticipants(
                new InsufficientParticipantsForDrawException("At least 3 participants are required"));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY.value());
        assertThat(problem.getTitle()).isEqualTo("Unprocessable Entity");
        assertThat(problem.getDetail()).contains("At least 3 participants");
        assertThat(problem.getProperties()).containsEntry("errorCode", "INSUFFICIENT_PARTICIPANTS");
    }

    @Test
    void shouldConfigureApiCorsMappingsWithoutError() {
        WebCorsConfig corsConfig = new WebCorsConfig();
        CorsRegistry registry = new CorsRegistry();
        corsConfig.addCorsMappings(registry);
        assertThat(corsConfig).isNotNull();
    }
}
