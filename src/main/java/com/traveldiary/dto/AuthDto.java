package com.traveldiary.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

public class AuthDto {

    @Data
    public static class RegisterRequest {

        @NotBlank(message = "Имя обязательно")
        @Size(min = 2, max = 100, message = "Имя должно быть от 2 до 100 символов")
        private String name;

        @NotBlank(message = "Email обязателен")
        @Email(message = "Некорректный формат email")
        private String email;

        @NotBlank(message = "Пароль обязателен")
        @Size(min = 8, message = "Пароль должен быть не менее 8 символов")
        private String password;
    }

    @Data
    public static class LoginRequest {

        @NotBlank(message = "Email обязателен")
        @Email
        private String email;

        @NotBlank(message = "Пароль обязателен")
        private String password;
    }

    @Data
    public static class AuthResponse {
        private UserDto user;
        private String emailConfirmationLink;

        public AuthResponse(UserDto user) {
            this.user = user;
        }

        public AuthResponse(UserDto user, String emailConfirmationLink) {
            this.user = user;
            this.emailConfirmationLink = emailConfirmationLink;
        }
    }

    @Data
    public static class ForgotPasswordRequest {
        @NotBlank
        @Email
        private String email;
    }

    @Data
    public static class ResetPasswordRequest {
        @NotBlank(message = "Токен обязателен")
        private String token;

        @NotBlank(message = "Новый пароль обязателен")
        @Size(min = 8, message = "Пароль должен быть не менее 8 символов")
        private String newPassword;
    }
}
