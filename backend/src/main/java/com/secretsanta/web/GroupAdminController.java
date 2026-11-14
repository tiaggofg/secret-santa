package com.secretsanta.web;

import com.secretsanta.application.SecretSantaApplicationService;
import com.secretsanta.application.SecretSantaApplicationService.AdminGroupView;
import com.secretsanta.application.SecretSantaApplicationService.PasswordResetLinkView;
import com.secretsanta.application.StatelessSessionTokenService;
import com.secretsanta.application.StatelessSessionTokenService.AuthenticatedUser;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
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
public class GroupAdminController {

    private final SecretSantaApplicationService applicationService;
    private final StatelessSessionTokenService tokenService;

    public GroupAdminController(
            SecretSantaApplicationService applicationService,
            StatelessSessionTokenService tokenService) {
        this.applicationService = applicationService;
        this.tokenService = tokenService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminGroupView createGroup(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestBody CreateGroupRequest request) {
        AuthenticatedUser user = tokenService.parseAndValidate(authorizationHeader);
        String eventName = request != null ? request.eventName() : null;
        return applicationService.createGroup(user.userId(), eventName);
    }

    @GetMapping("/{slug}/admin")
    @ResponseStatus(HttpStatus.OK)
    public AdminGroupView getAdminGroup(
            @PathVariable("slug") String slug,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        AuthenticatedUser user = tokenService.parseAndValidate(authorizationHeader);
        return applicationService.getAdminGroup(slug, user.userId());
    }

    @DeleteMapping("/{slug}/admin/participants/{participantId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeParticipant(
            @PathVariable("slug") String slug,
            @PathVariable("participantId") UUID participantId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        AuthenticatedUser user = tokenService.parseAndValidate(authorizationHeader);
        applicationService.removeParticipant(slug, user.userId(), participantId);
    }

    @PostMapping("/{slug}/admin/draw")
    @ResponseStatus(HttpStatus.OK)
    public AdminGroupView executeDraw(
            @PathVariable("slug") String slug,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        AuthenticatedUser user = tokenService.parseAndValidate(authorizationHeader);
        return applicationService.executeDraw(slug, user.userId());
    }

    @PostMapping("/{slug}/admin/participants/{participantId}/reset-token")
    @ResponseStatus(HttpStatus.OK)
    public PasswordResetLinkView generatePasswordResetToken(
            @PathVariable("slug") String slug,
            @PathVariable("participantId") UUID participantId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        AuthenticatedUser user = tokenService.parseAndValidate(authorizationHeader);
        return applicationService.generatePasswordResetToken(slug, user.userId(), participantId);
    }

    public record CreateGroupRequest(String eventName) {
    }
}
