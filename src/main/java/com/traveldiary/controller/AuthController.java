package com.traveldiary.controller;

import com.traveldiary.dto.AuthDto;
import com.traveldiary.dto.UserDto;
import com.traveldiary.entity.User;
import com.traveldiary.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final SecurityContextRepository securityContextRepository = new HttpSessionSecurityContextRepository();

    @PostMapping("/register")
    public ResponseEntity<AuthDto.AuthResponse> register(
            @Valid @RequestBody AuthDto.RegisterRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        AuthDto.AuthResponse response = authService.register(request, getBaseUrl(httpRequest));

        securityContextRepository.saveContext(SecurityContextHolder.getContext(), httpRequest, httpResponse);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthDto.AuthResponse> login(
            @Valid @RequestBody AuthDto.LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        AuthDto.AuthResponse response = authService.login(request);
        securityContextRepository.saveContext(SecurityContextHolder.getContext(), httpRequest, httpResponse);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> getCurrentUser(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(UserDto.from(user));
    }

    @PostMapping("/email-confirmation")
    public ResponseEntity<Map<String, String>> createEmailConfirmationLink(
            @AuthenticationPrincipal User user,
            HttpServletRequest httpRequest) {
        String confirmationLink = authService.createEmailConfirmationLink(user.getEmail(), getBaseUrl(httpRequest));
        if (confirmationLink == null) {
            return ResponseEntity.ok(Map.of("message", "Email уже подтверждён"));
        }
        return ResponseEntity.ok(Map.of(
                "message", "Ссылка подтверждения создана",
                "emailConfirmationLink", confirmationLink));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletRequest request) {
        SecurityContextHolder.clearContext();

        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }

        ResponseCookie sessionCookie = ResponseCookie.from("JSESSIONID", "")
                .path("/")
                .httpOnly(true)
                .maxAge(0)
                .sameSite("Lax")
                .build();
        ResponseCookie csrfCookie = ResponseCookie.from("XSRF-TOKEN", "")
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, sessionCookie.toString())
                .header(HttpHeaders.SET_COOKIE, csrfCookie.toString())
                .body(Map.of("message", "Выход выполнен успешно"));
    }


    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(
            @Valid @RequestBody AuthDto.ForgotPasswordRequest request,
            HttpServletRequest httpRequest) {
        String resetLink = authService.forgotPassword(request.getEmail(), getBaseUrl(httpRequest));
        if (resetLink != null) {
            return ResponseEntity.ok(Map.of(
                    "message", "Если email зарегистрирован — инструкции отправлены",
                    "resetLink", resetLink));
        }
        return ResponseEntity.ok(Map.of(
                "message", "Если email зарегистрирован — инструкции отправлены"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(
            @Valid @RequestBody AuthDto.ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.ok(Map.of("message", "Пароль успешно изменён"));
    }

    @GetMapping("/confirm-email")
    public ResponseEntity<Map<String, String>> confirmEmail(@RequestParam String token) {
        authService.confirmEmail(token);
        return ResponseEntity.ok(Map.of("message", "Email успешно подтверждён"));
    }

    private String getBaseUrl(HttpServletRequest request) {
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        String forwardedHost = request.getHeader("X-Forwarded-Host");
        if (forwardedHost != null && !forwardedHost.isBlank()) {
            String proto = forwardedProto != null && !forwardedProto.isBlank()
                    ? forwardedProto
                    : request.getScheme();
            return proto + "://" + forwardedHost;
        }
        boolean defaultPort = request.getServerPort() == 80 || request.getServerPort() == 443;
        return request.getScheme() + "://" + request.getServerName()
                + (defaultPort ? "" : ":" + request.getServerPort());
    }
}
