package com.secretsanta.web;

import com.secretsanta.application.SecretSantaApplicationService;
import com.secretsanta.application.SecretSantaApplicationService.GroupDiscoveryView;
import com.secretsanta.application.SecretSantaApplicationService.ParticipantRegistrationView;
import com.secretsanta.application.SecretSantaApplicationService.PublicGroupView;
import com.secretsanta.application.SecretSantaApplicationService.RevealMatchView;
import com.secretsanta.application.SecretSantaApplicationService.VisitorJoinResult;
import com.secretsanta.application.StatelessSessionTokenService.AuthenticatedUser;
import com.secretsanta.domain.exception.InvalidCredentialsException;
import com.secretsanta.domain.exception.ResourceNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/groups")
public class GroupPublicController {

    private final SecretSantaApplicationService applicationService;
    private final AuthCookieManager cookieManager;

    public GroupPublicController(
            SecretSantaApplicationService applicationService,
            AuthCookieManager cookieManager) {
        this.applicationService = applicationService;
        this.cookieManager = cookieManager;
    }

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public GroupDiscoveryView listGroups(HttpServletRequest httpRequest) {
        AuthenticatedUser user = cookieManager.requireAuthenticatedUser(httpRequest);
        return applicationService.listGroupsForUser(user.userId());
    }

    @GetMapping("/{groupId}")
    @ResponseStatus(HttpStatus.OK)
    public PublicGroupView getPublicGroup(
            @PathVariable("groupId") String groupIdRaw,
            @RequestParam(value = "sig", required = false) String inviteSignature,
            HttpServletRequest httpRequest) {
        UUID groupId = parseGroupId(groupIdRaw);
        UUID currentUserId = cookieManager.resolveOptionalUserId(httpRequest).orElse(null);
        return applicationService.getPublicGroup(groupId, currentUserId, inviteSignature);
    }

    @PostMapping("/{groupId}/participants")
    @ResponseStatus(HttpStatus.CREATED)
    public ParticipantRegistrationView joinGroup(
            @PathVariable("groupId") String groupIdRaw,
            @RequestBody(required = false) JoinGroupRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        UUID groupId = parseGroupId(groupIdRaw);
        Double latitude = request != null ? request.latitude() : null;
        Double longitude = request != null ? request.longitude() : null;
        String inviteSignature = request != null ? request.inviteSignature() : null;

        boolean hasVisitorCredentials = request != null
                && ((request.name() != null && !request.name().isBlank())
                        || (request.username() != null && !request.username().isBlank()));

        if (!hasVisitorCredentials) {
            Optional<UUID> authenticatedUserId = cookieManager.resolveOptionalUserId(httpRequest);
            if (authenticatedUserId.isPresent()) {
                return applicationService.registerParticipant(
                        groupId,
                        authenticatedUserId.get(),
                        inviteSignature,
                        latitude,
                        longitude);
            }
            throw new InvalidCredentialsException("Authentication token or user registration details are required to join");
        }

        String effectivePassword = firstNonBlank(request.password(), request.pin());
        VisitorJoinResult result = applicationService.registerVisitorAndJoinGroupWithTokens(
                groupId,
                request.name(),
                request.username(),
                effectivePassword,
                inviteSignature,
                latitude,
                longitude);
        cookieManager.setAuthCookies(httpResponse, httpRequest, result.accessToken(), result.refreshToken());
        return result.participant();
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
        String effectivePassword = firstNonBlank(request.password(), request.pin());
        return applicationService.revealMatch(groupId, request.username(), effectivePassword);
    }

    static UUID parseGroupId(String groupIdRaw) {
        try {
            return UUID.fromString(groupIdRaw);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new ResourceNotFoundException("Group not found: " + groupIdRaw);
        }
    }

    private static String firstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary;
        }
        return fallback != null ? fallback : primary;
    }

    public record JoinGroupRequest(
            String name,
            String username,
            String password,
            String pin,
            String inviteSignature,
            Double latitude,
            Double longitude) {
    }

    public record RevealMatchRequest(
            String username,
            String password,
            String pin) {
    }
}
