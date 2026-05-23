package com.traveldiary.dto;

import com.traveldiary.entity.User;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class UserDto {
    private Long id;
    private String name;
    private String email;
    private String avatarUrl;
    private String homeCountry;
    private User.Role role;
    private boolean emailConfirmed;

    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    public static UserDto from(User user) {
        return UserDto.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .avatarUrl(user.getAvatarUrl())
                .homeCountry(user.getHomeCountry())
                .role(user.getRole())
                .emailConfirmed(user.isEmailConfirmed())
                .createdAt(user.getCreatedAt())
                .build();
    }

    @Data
    public static class UpdateProfileRequest {
        @jakarta.validation.constraints.NotBlank
        @jakarta.validation.constraints.Size(min = 2, max = 100)
        private String name;

        @jakarta.validation.constraints.NotBlank
        @jakarta.validation.constraints.Email
        private String email;
    }

    @Data
    public static class UpdatePasswordRequest {
        @jakarta.validation.constraints.NotBlank
        private String currentPassword;

        @jakarta.validation.constraints.NotBlank
        @jakarta.validation.constraints.Size(min = 8)
        private String newPassword;
    }
}
