package com.secretsanta.web;

import com.secretsanta.application.SecretSantaApplicationService;
import com.secretsanta.application.SecretSantaApplicationService.AdminGroupView;
import com.secretsanta.application.SecretSantaApplicationService.PasswordResetLinkView;
import com.secretsanta.application.StatelessSessionTokenService.AuthenticatedUser;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/groups")
public class GroupAdminController {

    private final SecretSantaApplicationService applicationService;
    private final AuthCookieManager cookieManager;

    public GroupAdminController(
            SecretSantaApplicationService applicationService,
            AuthCookieManager cookieManager) {
        this.applicationService = applicationService;
        this.cookieManager = cookieManager;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminGroupView createGroup(
            HttpServletRequest httpRequest,
            @RequestBody(required = false) CreateGroupRequest request) {
        AuthenticatedUser user = cookieManager.requireAuthenticatedUser(httpRequest);
        String eventName = request != null ? request.eventName() : null;
        return applicationService.createGroup(user.userId(), eventName);
    }

    @GetMapping("/{groupId}/admin")
    @ResponseStatus(HttpStatus.OK)
    public AdminGroupView getAdminGroup(
            @PathVariable("groupId") String groupIdRaw,
            HttpServletRequest httpRequest) {
        UUID groupId = GroupPublicController.parseGroupId(groupIdRaw);
        AuthenticatedUser user = cookieManager.requireAuthenticatedUser(httpRequest);
        return applicationService.getAdminGroup(groupId, user.userId());
    }

    @PostMapping("/{groupId}/admin/invite-link/rotate")
    @ResponseStatus(HttpStatus.OK)
    public AdminGroupView rotateInviteLink(
            @PathVariable("groupId") String groupIdRaw,
            HttpServletRequest httpRequest) {
        UUID groupId = GroupPublicController.parseGroupId(groupIdRaw);
        AuthenticatedUser user = cookieManager.requireAuthenticatedUser(httpRequest);
        return applicationService.rotateInviteSignature(groupId, user.userId());
    }

    @DeleteMapping("/{groupId}/admin/participants/{participantId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeParticipant(
            @PathVariable("groupId") String groupIdRaw,
            @PathVariable("participantId") UUID participantId,
            HttpServletRequest httpRequest) {
        UUID groupId = GroupPublicController.parseGroupId(groupIdRaw);
        AuthenticatedUser user = cookieManager.requireAuthenticatedUser(httpRequest);
        applicationService.removeParticipant(groupId, user.userId(), participantId);
    }

    @PostMapping("/{groupId}/admin/draw")
    @ResponseStatus(HttpStatus.OK)
    public AdminGroupView executeDraw(
            @PathVariable("groupId") String groupIdRaw,
            HttpServletRequest httpRequest) {
        UUID groupId = GroupPublicController.parseGroupId(groupIdRaw);
        AuthenticatedUser user = cookieManager.requireAuthenticatedUser(httpRequest);
        return applicationService.executeDraw(groupId, user.userId());
    }

    @PostMapping("/{groupId}/admin/participants/{participantId}/reset-token")
    @ResponseStatus(HttpStatus.OK)
    public PasswordResetLinkView generatePasswordResetToken(
            @PathVariable("groupId") String groupIdRaw,
            @PathVariable("participantId") UUID participantId,
            HttpServletRequest httpRequest) {
        UUID groupId = GroupPublicController.parseGroupId(groupIdRaw);
        AuthenticatedUser user = cookieManager.requireAuthenticatedUser(httpRequest);
        return applicationService.generatePasswordResetToken(groupId, user.userId(), participantId);
    }

    public record CreateGroupRequest(String eventName) {
    }
}
