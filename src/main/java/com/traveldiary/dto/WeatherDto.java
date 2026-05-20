package com.traveldiary.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

public class WeatherDto {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailyForecast {
        private String date;
        private double tempMin;
        private double tempMax;
        private double tempCurrent;
        private int humidity;
        private double windSpeed;
        private String description;
        private String icon;
        private double precipitation;
        private boolean isRainy;
        private boolean isCold;
        private boolean isHot;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WeeklyForecast {
        private Double latitude;
        private Double longitude;
        private String locationName;
        private List<DailyForecast> days;
        private boolean fromCache;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PackingRecommendations {
        private List<String> essentials;
        private List<String> clothing;
        private List<String> weatherGear;
        private List<String> accessories;
        private String weatherSummary;
        private String bestTimeToVisit;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GeocodeSuggestion {
        private String displayName;
        private double lat;
        private double lon;
    }
}
