package com.secretsanta.web;

import com.secretsanta.application.SecretSantaApplicationService;
import com.secretsanta.application.StatelessSessionTokenService;
import com.secretsanta.application.StatelessSessionTokenService.AuthenticatedUser;
import com.secretsanta.domain.exception.InvalidCredentialsException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class AuthCookieManager {

    public static final String ACCESS_TOKEN_COOKIE = "ss_access_token";
    public static final String REFRESH_TOKEN_COOKIE = "ss_refresh_token";
    private static final String ACCESS_COOKIE_PATH = "/api/v1";
    private static final String REFRESH_COOKIE_PATH = "/api/v1/auth";

    private final StatelessSessionTokenService tokenService;
    private final SecretSantaApplicationService applicationService;
    private final Boolean secureOverride;
    private final String sameSite;
    private final String domain;

    public AuthCookieManager(
            StatelessSessionTokenService tokenService,
            SecretSantaApplicationService applicationService,
            @Value("${secretsanta.security.cookie.secure:}") String secureConfig,
            @Value("${secretsanta.security.cookie.same-site:Lax}") String sameSite,
            @Value("${secretsanta.security.cookie.domain:}") String domain) {
        this.tokenService = tokenService;
        this.applicationService = applicationService;
        this.secureOverride = (secureConfig == null || secureConfig.isBlank())
                ? null
                : Boolean.parseBoolean(secureConfig.trim());
        this.sameSite = (sameSite == null || sameSite.isBlank()) ? "Lax" : sameSite.trim();
        this.domain = (domain == null || domain.isBlank()) ? null : domain.trim();
    }

    public void setAuthCookies(
            HttpServletResponse response,
            HttpServletRequest request,
            String accessToken,
            String refreshToken) {
        boolean secure = resolveSecure(request);
        ResponseCookie accessCookie = buildCookie(
                ACCESS_TOKEN_COOKIE,
                accessToken,
                ACCESS_COOKIE_PATH,
                tokenService.accessTokenTtlSeconds(),
                secure);
        ResponseCookie refreshCookie = buildCookie(
                REFRESH_TOKEN_COOKIE,
                refreshToken,
                REFRESH_COOKIE_PATH,
                applicationService.refreshTokenTtlSeconds(),
                secure);

        response.addHeader(HttpHeaders.SET_COOKIE, accessCookie.toString());
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());
    }

    public void clearAuthCookies(HttpServletResponse response, HttpServletRequest request) {
        boolean secure = resolveSecure(request);
        ResponseCookie accessCookie = buildCookie(ACCESS_TOKEN_COOKIE, "", ACCESS_COOKIE_PATH, 0, secure);
        ResponseCookie refreshCookie = buildCookie(REFRESH_TOKEN_COOKIE, "", REFRESH_COOKIE_PATH, 0, secure);

        response.addHeader(HttpHeaders.SET_COOKIE, accessCookie.toString());
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());
    }

    public AuthenticatedUser requireAuthenticatedUser(HttpServletRequest request) {
        String token = extractCookie(request, ACCESS_TOKEN_COOKIE)
                .orElseThrow(() -> new InvalidCredentialsException("Authentication token is required"));
        return tokenService.parseAndValidate(token);
    }

    public Optional<UUID> resolveOptionalUserId(HttpServletRequest request) {
        Optional<String> token = extractCookie(request, ACCESS_TOKEN_COOKIE);
        if (token.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(tokenService.parseAndValidate(token.get()).userId());
    }

    public Optional<String> extractRefreshToken(HttpServletRequest request) {
        return extractCookie(request, REFRESH_TOKEN_COOKIE);
    }

    private Optional<String> extractCookie(HttpServletRequest request, String cookieName) {
        if (request == null || request.getCookies() == null) {
            return Optional.empty();
        }
        for (Cookie cookie : request.getCookies()) {
            if (cookieName.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                return Optional.of(cookie.getValue());
            }
        }
        return Optional.empty();
    }

    private boolean resolveSecure(HttpServletRequest request) {
        if (secureOverride != null) {
            return secureOverride;
        }
        return request != null && request.isSecure();
    }

    private ResponseCookie buildCookie(
            String name,
            String value,
            String path,
            long maxAgeSeconds,
            boolean secure) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite(sameSite)
                .path(path)
                .maxAge(maxAgeSeconds);
        if (domain != null) {
            builder.domain(domain);
        }
        return builder.build();
    }
}
