package com.secretsanta.web;

import com.secretsanta.application.SecretSantaApplicationService;
import com.secretsanta.application.SecretSantaApplicationService.AuthSessionResult;
import com.secretsanta.application.SecretSantaApplicationService.AuthUserView;
import com.secretsanta.application.SecretSantaApplicationService.PinResetResultView;
import com.secretsanta.application.StatelessSessionTokenService.AuthenticatedUser;
import com.secretsanta.domain.exception.InvalidCredentialsException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final SecretSantaApplicationService applicationService;
    private final AuthCookieManager cookieManager;

    public AuthController(
            SecretSantaApplicationService applicationService,
            AuthCookieManager cookieManager) {
        this.applicationService = applicationService;
        this.cookieManager = cookieManager;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthUserView register(
            @RequestBody(required = false) RegisterUserRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        String name = request != null ? request.name() : null;
        String username = request != null ? request.username() : null;
        String password = request != null ? firstNonBlank(request.password(), request.pin()) : null;

        AuthSessionResult session = applicationService.registerUserWithTokens(name, username, password);
        cookieManager.setAuthCookies(httpResponse, httpRequest, session.accessToken(), session.refreshToken());
        return session.toUserView();
    }

    @PostMapping("/login")
    @ResponseStatus(HttpStatus.OK)
    public AuthUserView login(
            @RequestBody(required = false) LoginUserRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        String username = request != null ? request.username() : null;
        String password = request != null ? firstNonBlank(request.password(), request.pin()) : null;

        AuthSessionResult session = applicationService.loginUserWithTokens(username, password);
        cookieManager.setAuthCookies(httpResponse, httpRequest, session.accessToken(), session.refreshToken());
        return session.toUserView();
    }

    @PostMapping("/refresh")
    @ResponseStatus(HttpStatus.OK)
    public AuthUserView refresh(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        String rawRefreshToken = cookieManager.extractRefreshToken(httpRequest).orElse(null);
        try {
            AuthSessionResult session = applicationService.refreshSession(rawRefreshToken);
            cookieManager.setAuthCookies(httpResponse, httpRequest, session.accessToken(), session.refreshToken());
            return session.toUserView();
        } catch (InvalidCredentialsException ex) {
            cookieManager.clearAuthCookies(httpResponse, httpRequest);
            throw ex;
        }
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        cookieManager.extractRefreshToken(httpRequest)
                .ifPresent(applicationService::logoutSession);
        cookieManager.clearAuthCookies(httpResponse, httpRequest);
    }

    @GetMapping("/me")
    @ResponseStatus(HttpStatus.OK)
    public AuthUserView me(HttpServletRequest httpRequest) {
        AuthenticatedUser user = cookieManager.requireAuthenticatedUser(httpRequest);
        return applicationService.getCurrentUser(user.userId());
    }

    @PostMapping({"/reset-password", "/reset-pin"})
    @ResponseStatus(HttpStatus.OK)
    public PinResetResultView resetPassword(
            @RequestBody(required = false) ResetPasswordRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        if (request == null) {
            return applicationService.resetPasswordWithToken(null, null);
        }
        String effectiveNewPassword = firstNonBlank(request.newPassword(), request.newPin(), request.pin());
        PinResetResultView result = applicationService.resetPasswordWithToken(request.token(), effectiveNewPassword);
        cookieManager.clearAuthCookies(httpResponse, httpRequest);
        return result;
    }

    private static String firstNonBlank(String... candidates) {
        if (candidates == null) {
            return null;
        }
        for (String candidate : candidates) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate;
            }
        }
        return candidates.length > 0 ? candidates[0] : null;
    }

    public record RegisterUserRequest(String name, String username, String password, String pin) {
    }

    public record LoginUserRequest(String username, String password, String pin) {
    }

    public record ResetPasswordRequest(String token, String newPassword, String newPin, String pin) {
    }
}
