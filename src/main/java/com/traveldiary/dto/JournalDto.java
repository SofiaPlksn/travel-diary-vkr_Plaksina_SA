package com.traveldiary.dto;

import com.traveldiary.entity.JournalEntry;
import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class JournalDto {

    @Data
    public static class CreateRequest {
        @NotBlank(message = "Заголовок записи обязателен")
        private String title;

        @NotBlank(message = "Содержимое записи обязательно")
        private String content;

        private LocalDate entryDate;
        private JournalEntry.Mood mood;
        private String weatherSummary;

        private boolean published = false;
    }

    @Data
    public static class UpdateRequest {
        private String title;
        private String content;
        private LocalDate entryDate;
        private JournalEntry.Mood mood;
        private String weatherSummary;
        private Boolean published;
    }

    @Data
    @Builder
    public static class Response {
        private Long id;
        private String title;
        private String content;
        private LocalDate entryDate;
        private JournalEntry.Mood mood;
        private String weatherSummary;
        private boolean published;
        private Long tripId;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }
}
