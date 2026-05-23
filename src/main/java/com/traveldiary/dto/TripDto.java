package com.traveldiary.dto;

import com.traveldiary.entity.Trip;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

public class TripDto {

    @Data
    public static class CreateRequest {

        @NotBlank(message = "Название поездки обязательно")
        @Size(min = 2, max = 200)
        private String title;

        @Size(max = 2000)
        private String description;

        @NotBlank(message = "Страна обязательна")
        private String country;

        private String city;

        @NotNull(message = "Дата начала обязательна")
        private LocalDate startDate;

        private LocalDate endDate;

        private Trip.Visibility visibility = Trip.Visibility.PRIVATE;
        private Trip.Status status = Trip.Status.PLANNED;

        private List<String> tags;
    }

    @Data
    public static class UpdateRequest {
        private String title;
        private String description;
        private String country;
        private String city;
        private LocalDate startDate;
        private LocalDate endDate;
        private String coverImageUrl;
        private Trip.Visibility visibility;
        private Trip.Status status;
        private List<String> tags;
    }

    @Data
    @Builder
    public static class Response {
        private Long id;
        private String title;
        private String description;
        private String country;
        private String city;
        private LocalDate startDate;
        private LocalDate endDate;
        private String coverImageUrl;
        private Trip.Visibility visibility;
        private Trip.Status status;
        private String shareToken;
        private LocalDateTime shareTokenExpiry;

        private int placesCount;
        private int mediaCount;
        private int journalEntriesCount;

        private Set<String> tags;

        private Long userId;
        private String userName;

        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data
    @Builder
    public static class Summary {
        private Long id;
        private String title;
        private String country;
        private String city;
        private LocalDate startDate;
        private LocalDate endDate;
        private String coverImageUrl;
        private Trip.Status status;
        private Trip.Visibility visibility;
        private int placesCount;
        private int mediaCount;
        private Set<String> tags;
    }

}
