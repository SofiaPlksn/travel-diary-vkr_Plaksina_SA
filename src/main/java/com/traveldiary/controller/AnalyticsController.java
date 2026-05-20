package com.traveldiary.controller;

import com.traveldiary.dto.AnalyticsDto;
import com.traveldiary.entity.User;
import com.traveldiary.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping
    public ResponseEntity<AnalyticsDto.UserAnalytics> getAnalytics(
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(analyticsService.getUserAnalytics(user.getId()));
    }

    @GetMapping("/achievements")
    public ResponseEntity<?> getAchievements(
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(
                analyticsService.getUserAnalytics(user.getId()).getAchievements()
        );
    }

    @GetMapping("/map")
    public ResponseEntity<AnalyticsDto.GlobalMapData> getGlobalMapData(
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(analyticsService.getGlobalMapData(user.getId()));
    }
}
