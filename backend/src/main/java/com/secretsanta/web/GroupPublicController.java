package com.secretsanta.web;

import com.secretsanta.application.SecretSantaApplicationService;
import com.secretsanta.application.SecretSantaApplicationService.GroupDiscoveryView;
import com.secretsanta.application.SecretSantaApplicationService.ParticipantRegistrationView;
import com.secretsanta.application.SecretSantaApplicationService.PublicGroupView;
import com.secretsanta.application.SecretSantaApplicationService.RevealMatchView;
import com.secretsanta.application.StatelessSessionTokenService;
import com.secretsanta.application.StatelessSessionTokenService.AuthenticatedUser;
import com.secretsanta.domain.exception.InvalidCredentialsException;
import com.secretsanta.domain.exception.ResourceNotFoundException;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/groups")
public class GroupPublicController {

    private final SecretSantaApplicationService applicationService;
    private final StatelessSessionTokenService tokenService;

    public GroupPublicController(
            SecretSantaApplicationService applicationService,
            StatelessSessionTokenService tokenService) {
        this.applicationService = applicationService;
        this.tokenService = tokenService;
    }

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public GroupDiscoveryView listGroups(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        AuthenticatedUser user = tokenService.parseAndValidate(authorizationHeader);
        return applicationService.listGroupsForUser(user.userId());
    }

    @GetMapping("/{groupId}")
    @ResponseStatus(HttpStatus.OK)
    public PublicGroupView getPublicGroup(
            @PathVariable("groupId") String groupIdRaw,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        UUID groupId = parseGroupId(groupIdRaw);
        UUID currentUserId = null;
        if (authorizationHeader != null && !authorizationHeader.isBlank()) {
            currentUserId = tokenService.parseAndValidate(authorizationHeader).userId();
        }
        return applicationService.getPublicGroup(groupId, currentUserId);
    }

    @PostMapping("/{groupId}/participants")
    @ResponseStatus(HttpStatus.CREATED)
    public ParticipantRegistrationView joinGroup(
            @PathVariable("groupId") String groupIdRaw,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestBody(required = false) JoinGroupRequest request) {
        UUID groupId = parseGroupId(groupIdRaw);
        Double latitude = request != null ? request.latitude() : null;
        Double longitude = request != null ? request.longitude() : null;
        String groupPin = request != null ? request.groupPin() : null;

        if (authorizationHeader != null && !authorizationHeader.isBlank()) {
            AuthenticatedUser user = tokenService.parseAndValidate(authorizationHeader);
            return applicationService.registerParticipant(groupId, user.userId(), groupPin, latitude, longitude);
        }

        if (request != null
                && ((request.name() != null && !request.name().isBlank())
                        || (request.username() != null && !request.username().isBlank()))) {
            return applicationService.registerVisitorAndJoinGroup(
                    groupId,
                    request.name(),
                    request.username(),
                    request.pin(),
                    groupPin,
                    latitude,
                    longitude);
        }

        throw new InvalidCredentialsException("Authentication token or user registration details are required to join");
    }

    @PostMapping("/{groupId}/participants/reveal")
    @ResponseStatus(HttpStatus.OK)
    public RevealMatchView revealMatch(
            @PathVariable("groupId") String groupIdRaw,
            @RequestBody(required = false) RevealMatchRequest request) {
        UUID groupId = parseGroupId(groupIdRaw);
        if (request == null) {
            return applicationService.revealMatch(groupId, null, null);
        }
        return applicationService.revealMatch(groupId, request.username(), request.pin());
    }

    static UUID parseGroupId(String groupIdRaw) {
        try {
            return UUID.fromString(groupIdRaw);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new ResourceNotFoundException("Group not found: " + groupIdRaw);
        }
    }

    public record JoinGroupRequest(
            String name,
            String username,
            String pin,
            String groupPin,
            Double latitude,
            Double longitude) {
    }

    public record RevealMatchRequest(
            String username,
            String pin) {
    }
}
