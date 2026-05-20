package com.traveldiary.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class AnalyticsDto {

    @Data
    @Builder
    public static class Achievement {
        private String id;
        private String title;
        private String description;
        private String emoji;
        private boolean unlocked;

        @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime unlockedAt;
        private int progress;
        private int target;
    }

    @Data
    @Builder
    public static class UserAnalytics {

        private long totalTrips;
        private long completedTrips;
        private long activeTrips;
        private long plannedTrips;
        private long totalPlaces;
        private long totalMedia;
        private long totalJournalEntries;
        private long totalTripDays;

        private long countriesVisited;
        private long citiesVisited;
        private List<String> visitedCountries;

        private long hotelsCount;
        private long restaurantsCount;
        private long attractionsCount;
        private long museumsCount;

        private List<Achievement> achievements;
        private long unlockedAchievementsCount;
        private long totalAchievementsCount;

        private List<CountryStat> topCountries;

        private Map<String, Long> monthlyStats;
    }

    @Data
    @Builder
    public static class CountryStat {
        private String country;
        private long tripsCount;
        private long placesCount;
        private long mediaCount;
    }

    @Data
    @Builder
    public static class MapPoint {
        private String id;
        private String type;
        private double lat;
        private double lng;
        private String title;
        private String thumbnailUrl;
        private Long tripId;
        private String tripTitle;
    }

    @Data
    @Builder
    public static class GlobalMapData {
        private List<MapPoint> points;
    }
}
