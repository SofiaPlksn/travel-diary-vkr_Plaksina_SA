package com.traveldiary.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

public class MediaDto {

    @Data
    @Builder
    public static class Response {
        private Long id;
        private String originalFileName;
        private String fileUrl;
        private String thumbnailUrl;
        private Long fileSize;
        private String contentType;

        private LocalDateTime exifDate;
        private Double exifLatitude;
        private Double exifLongitude;
        private String cameraModel;

        private String caption;
        private Integer sortOrder;
        private Long tripId;
        private Long placeId;
        private LocalDateTime createdAt;
    }

    @Data
    public static class UpdateRequest {
        private String caption;
        private Integer sortOrder;
        private Long placeId;
        private Double latitude;
        private Double longitude;
    }

    @Data
    @Builder
    public static class GalleryItem {
        private Long id;
        private String thumbnailUrl;
        private String fileUrl;
        private String contentType;
        private String caption;
        private LocalDateTime exifDate;
        private Double exifLatitude;
        private Double exifLongitude;
        private Integer sortOrder;
    }
}
