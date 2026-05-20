package com.traveldiary.controller;

import com.traveldiary.dto.WeatherDto;
import com.traveldiary.service.WeatherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/weather")
@RequiredArgsConstructor
public class WeatherController {

    private final WeatherService weatherService;

    @GetMapping("/forecast")
    public ResponseEntity<?> getForecast(
            @RequestParam Double lat,
            @RequestParam Double lon,
            @AuthenticationPrincipal UserDetails user
    ) {
        try {
            long start = System.nanoTime();
            WeatherDto.WeeklyForecast forecast = weatherService.getWeeklyForecast(lat, lon);
            long ms = (System.nanoTime() - start) / 1_000_000;

            String source = ms < 50 ? "REDIS CACHE" : "API";
            log.info("WEATHER forecast [{}, {}] — {} ms ({})", lat, lon, ms, source);

            return ResponseEntity.ok(forecast);
        } catch (Exception e) {
            log.error("Weather forecast error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", "Сервис погоды временно недоступен. Попробуйте позже."));
        }
    }

    @GetMapping("/forecast/city")
    public ResponseEntity<?> getForecastByCity(
            @RequestParam String city,
            @AuthenticationPrincipal UserDetails user
    ) {
        try {
            long start = System.nanoTime();
            WeatherDto.WeeklyForecast forecast = weatherService.getWeeklyForecastByCity(city);
            long ms = (System.nanoTime() - start) / 1_000_000;

            String source = ms < 50 ? "REDIS CACHE" : "API";
            log.info("WEATHER forecast/city [{}] — {} ms ({})", city, ms, source);

            return ResponseEntity.ok(forecast);
        } catch (RuntimeException e) {
            log.error("Weather forecast by city error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", e.getMessage() != null ? e.getMessage() : "Ошибка получения погоды"));
        }
    }

    @GetMapping("/historical/city")
    public ResponseEntity<?> getHistoricalWeatherByCity(
            @RequestParam String city,
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate date,
            @AuthenticationPrincipal UserDetails user
    ) {
        try {
            long start = System.nanoTime();
            WeatherDto.DailyForecast forecast = weatherService.getHistoricalWeatherByCity(city, date);
            long ms = (System.nanoTime() - start) / 1_000_000;

            log.info("WEATHER historical [{}] — {} ms", city, ms);

            return ResponseEntity.ok(forecast);
        } catch (RuntimeException e) {
            log.error("Historical weather error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", e.getMessage() != null ? e.getMessage() : "Ошибка получения исторической погоды"));
        }
    }

    @GetMapping("/packing")
    public ResponseEntity<?> getPackingList(
            @RequestParam Double lat,
            @RequestParam Double lon,
            @RequestParam(defaultValue = "поездки") String tripTitle,
            @AuthenticationPrincipal UserDetails user
    ) {
        try {
            long start = System.nanoTime();
            WeatherDto.PackingRecommendations result =
                    weatherService.getPackingRecommendations(lat, lon, tripTitle);
            long ms = (System.nanoTime() - start) / 1_000_000;

            log.info("WEATHER packing [{}, {}] — {} ms", lat, lon, ms);

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Packing recommendations error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", "Не удалось получить рекомендации. Попробуйте позже."));
        }
    }

    @GetMapping("/packing/city")
    public ResponseEntity<?> getPackingListByCity(
            @RequestParam String city,
            @RequestParam(defaultValue = "поездки") String tripTitle,
            @AuthenticationPrincipal UserDetails user
    ) {
        try {
            long start = System.nanoTime();
            WeatherDto.PackingRecommendations result =
                    weatherService.getPackingRecommendationsByCity(city, tripTitle);
            long ms = (System.nanoTime() - start) / 1_000_000;

            log.info("WEATHER packing/city [{}] — {} ms", city, ms);

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Packing by city error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", e.getMessage() != null ? e.getMessage() : "Ошибка получения рекомендаций"));
        }
    }

    @GetMapping("/geocode")
    public ResponseEntity<java.util.List<WeatherDto.GeocodeSuggestion>> geocode(
            @RequestParam String q,
            @AuthenticationPrincipal UserDetails user
    ) {
        return ResponseEntity.ok(weatherService.autocompleteAddress(q));
    }
}
