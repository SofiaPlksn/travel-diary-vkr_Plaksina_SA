package com.traveldiary.dto;

import com.traveldiary.entity.Place;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

public class PlaceDto {

    @Data
    public static class CreateRequest {

        @NotBlank(message = "Название места обязательно")
        private String name;

        private String description;
        private String address;

        private Double latitude;
        private Double longitude;

        @NotNull(message = "Категория обязательна")
        private Place.Category category;

        @Min(value = 1, message = "Рейтинг от 1 до 5")
        @Max(value = 5, message = "Рейтинг от 1 до 5")
        private Integer rating;

        private LocalDateTime visitedAt;
        private boolean wishlist = false;
        private String mapboxPlaceId;
    }

    @Data
    public static class UpdateRequest {
        private String name;
        private String description;
        private String address;
        private Double latitude;
        private Double longitude;
        private Place.Category category;
        private Integer rating;
        private LocalDateTime visitedAt;
        private Boolean wishlist;
    }

    @Data
    @Builder
    public static class Response {
        private Long id;
        private String name;
        private String description;
        private String address;
        private Double latitude;
        private Double longitude;
        private Place.Category category;
        private Integer rating;
        private LocalDateTime visitedAt;
        private boolean wishlist;
        private String mapboxPlaceId;
        private Long tripId;
        private LocalDateTime createdAt;
    }
}
