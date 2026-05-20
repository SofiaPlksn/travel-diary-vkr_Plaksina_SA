package com.traveldiary.controller;

import com.traveldiary.dto.UserDto;
import com.traveldiary.entity.User;
import com.traveldiary.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PutMapping("/me")
    public ResponseEntity<UserDto> updateProfile(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody UserDto.UpdateProfileRequest request
    ) {
        return ResponseEntity.ok(userService.updateProfile(user.getId(), request));
    }

    @PostMapping("/me/password")
    public ResponseEntity<Void> updatePassword(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody UserDto.UpdatePasswordRequest request
    ) {
        userService.updatePassword(user.getId(), request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/me/avatar")
    public ResponseEntity<UserDto> updateAvatar(
            @AuthenticationPrincipal User user,
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        return ResponseEntity.ok(userService.updateAvatar(user.getId(), file));
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteAccount(
            @AuthenticationPrincipal User user,
            HttpServletRequest request
    ) {
        userService.deleteAccount(user.getId());

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

        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, sessionCookie.toString())
                .header(HttpHeaders.SET_COOKIE, csrfCookie.toString())
                .build();
    }
}
