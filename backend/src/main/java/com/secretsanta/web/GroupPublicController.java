package com.secretsanta.web;

import com.secretsanta.application.SecretSantaApplicationService;
import com.secretsanta.application.SecretSantaApplicationService.GroupDiscoveryView;
import com.secretsanta.application.SecretSantaApplicationService.ParticipantRegistrationView;
import com.secretsanta.application.SecretSantaApplicationService.PublicGroupView;
import com.secretsanta.application.SecretSantaApplicationService.RevealMatchView;
import com.secretsanta.application.StatelessSessionTokenService;
import com.secretsanta.application.StatelessSessionTokenService.AuthenticatedUser;
import com.secretsanta.domain.exception.InvalidCredentialsException;
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

    @GetMapping("/{slug}")
    @ResponseStatus(HttpStatus.OK)
    public PublicGroupView getPublicGroup(
            @PathVariable("slug") String slug,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        UUID currentUserId = null;
        if (authorizationHeader != null && !authorizationHeader.isBlank()) {
            currentUserId = tokenService.parseAndValidate(authorizationHeader).userId();
        }
        return applicationService.getPublicGroup(slug, currentUserId);
    }

    @PostMapping("/{slug}/participants")
    @ResponseStatus(HttpStatus.CREATED)
    public ParticipantRegistrationView joinGroup(
            @PathVariable("slug") String slug,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestBody(required = false) JoinGroupRequest request) {
        Double latitude = request != null ? request.latitude() : null;
        Double longitude = request != null ? request.longitude() : null;

        if (authorizationHeader != null && !authorizationHeader.isBlank()) {
            AuthenticatedUser user = tokenService.parseAndValidate(authorizationHeader);
            return applicationService.registerParticipant(slug, user.userId(), latitude, longitude);
        }

        if (request != null
                && ((request.name() != null && !request.name().isBlank())
                        || (request.username() != null && !request.username().isBlank()))) {
            return applicationService.registerVisitorAndJoinGroup(
                    slug,
                    request.name(),
                    request.username(),
                    request.pin(),
                    latitude,
                    longitude);
        }

        throw new InvalidCredentialsException("Authentication token or user registration details are required to join");
    }

    @PostMapping("/{slug}/participants/reveal")
    @ResponseStatus(HttpStatus.OK)
    public RevealMatchView revealMatch(
            @PathVariable("slug") String slug,
            @RequestBody(required = false) RevealMatchRequest request) {
        if (request == null) {
            return applicationService.revealMatch(slug, null, null);
        }
        return applicationService.revealMatch(slug, request.username(), request.pin());
    }

    public record JoinGroupRequest(
            String name,
            String username,
            String pin,
            Double latitude,
            Double longitude) {
    }

    public record RevealMatchRequest(
            String username,
            String pin) {
    }
}
