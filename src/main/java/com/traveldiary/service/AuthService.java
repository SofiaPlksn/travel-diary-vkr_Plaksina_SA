package com.traveldiary.service;

import com.traveldiary.dto.AuthDto;
import com.traveldiary.dto.UserDto;
import com.traveldiary.entity.User;
import com.traveldiary.exception.EmailAlreadyExistsException;
import com.traveldiary.exception.ResourceNotFoundException;
import com.traveldiary.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final TokenStoreService tokenStoreService;

    @Transactional
    public AuthDto.AuthResponse register(AuthDto.RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new EmailAlreadyExistsException(
                    "Пользователь с email " + request.getEmail() + " уже существует");
        }

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail().toLowerCase())
                .password(passwordEncoder.encode(request.getPassword()))
                .build();

        userRepository.save(user);

        String confirmToken = tokenStoreService.createEmailConfirmToken(user.getEmail());
        log.info("Email confirmation token generated for {}. Token (dev only): {}", user.getEmail(), confirmToken);

        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail().toLowerCase(),
                        request.getPassword()));
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);

        return new AuthDto.AuthResponse(UserDto.from(user));
    }

    public AuthDto.AuthResponse login(AuthDto.LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail().toLowerCase(),
                        request.getPassword()));

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);

        User user = userRepository.findByEmail(request.getEmail().toLowerCase())
                .orElseThrow();
        return new AuthDto.AuthResponse(UserDto.from(user));
    }

    public void forgotPassword(String email) {
        boolean userExists = userRepository.existsByEmail(email.toLowerCase());
        if (userExists && !tokenStoreService.hasActivePasswordResetToken(email.toLowerCase())) {
            String token = tokenStoreService.createPasswordResetToken(email.toLowerCase());
            log.info("Password reset requested for {}. Token (dev only): {}", email, token);
        }
    }

    @Transactional
    public void resetPassword(AuthDto.ResetPasswordRequest request) {
        String email = tokenStoreService.getEmailByPasswordResetToken(request.getToken());
        if (email == null) {
            throw new IllegalArgumentException("Токен сброса пароля недействителен или истёк");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь не найден"));

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        tokenStoreService.invalidatePasswordResetToken(request.getToken(), email);
        log.info("Password reset successfully for email={}", email);
    }

    @Transactional
    public void confirmEmail(String token) {
        String email = tokenStoreService.confirmEmail(token);
        if (email == null) {
            throw new IllegalArgumentException("Токен подтверждения email недействителен или истёк");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь не найден"));
        user.setEmailConfirmed(true);
        userRepository.save(user);
        log.info("Email confirmed for {}", email);
    }
}
