package com.traveldiary.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

public class TripFileDto {

    @Data
    @Builder
    public static class Response {
        private Long id;
        private String originalFileName;
        private String fileUrl;
        private Long fileSize;
        private String contentType;
        private LocalDateTime createdAt;
    }
}
