package com.secretsanta.web;

import com.secretsanta.application.SecretSantaApplicationService;
import com.secretsanta.application.SecretSantaApplicationService.AuthSessionView;
import com.secretsanta.application.SecretSantaApplicationService.PinResetResultView;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final SecretSantaApplicationService applicationService;

    public AuthController(SecretSantaApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthSessionView register(@RequestBody RegisterUserRequest request) {
        if (request == null) {
            return applicationService.registerUser(null, null, null);
        }
        return applicationService.registerUser(request.name(), request.username(), request.pin());
    }

    @PostMapping("/login")
    @ResponseStatus(HttpStatus.OK)
    public AuthSessionView login(@RequestBody LoginUserRequest request) {
        if (request == null) {
            return applicationService.loginUser(null, null);
        }
        return applicationService.loginUser(request.username(), request.pin());
    }

    @PostMapping("/reset-pin")
    @ResponseStatus(HttpStatus.OK)
    public PinResetResultView resetPin(@RequestBody ResetPinRequest request) {
        if (request == null) {
            return applicationService.resetPinWithToken(null, null);
        }
        String effectiveNewPin = (request.newPin() != null && !request.newPin().isBlank())
                ? request.newPin()
                : request.pin();
        return applicationService.resetPinWithToken(request.token(), effectiveNewPin);
    }

    public record RegisterUserRequest(String name, String username, String pin) {
    }

    public record LoginUserRequest(String username, String pin) {
    }

    public record ResetPinRequest(String token, String newPin, String pin) {
    }
}
