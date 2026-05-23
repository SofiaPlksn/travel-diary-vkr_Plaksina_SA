package com.traveldiary.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.traveldiary.dto.WeatherDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class GigaChatService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${gigachat.enabled:true}")
    private boolean enabled;

    @Value("${gigachat.auth-key:}")
    private String authKey;

    @Value("${gigachat.scope:GIGACHAT_API_PERS}")
    private String scope;

    @Value("${gigachat.oauth-url:https://ngw.devices.sberbank.ru:9443/api/v2/oauth}")
    private String oauthUrl;

    @Value("${gigachat.base-url:https://gigachat.devices.sberbank.ru/api/v1}")
    private String baseUrl;

    @Value("${gigachat.model:GigaChat}")
    private String model;

    @Value("${gigachat.temperature:0.2}")
    private double temperature;

    @Value("${gigachat.max-tokens:900}")
    private int maxTokens;

    private volatile String accessToken;
    private volatile long tokenExpiresAtMillis;

    public Optional<WeatherDto.PackingRecommendations> generatePackingRecommendations(
            WeatherDto.WeeklyForecast forecast,
            String tripTitle
    ) {
        if (!isConfigured()) {
            return Optional.empty();
        }

        try {
            String token = getAccessToken();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            headers.setBearerAuth(token);

            Map<String, Object> body = Map.of(
                    "model", model,
                    "temperature", temperature,
                    "max_tokens", maxTokens,
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt()),
                            Map.of("role", "user", "content", buildWeatherPrompt(forecast, tripTitle))
                    )
            );

            ResponseEntity<String> response = restTemplate.exchange(
                    normalizedBaseUrl() + "/chat/completions",
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    String.class
            );

            JsonNode root = objectMapper.readTree(response.getBody());
            String content = root.path("choices").path(0).path("message").path("content").asText();
            WeatherDto.PackingRecommendations recommendations = parseRecommendations(content);
            recommendations.setRecommendationSource("GigaChat");
            return Optional.of(recommendations);
        } catch (Exception e) {
            log.warn("GigaChat packing recommendations unavailable, using local rules: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private boolean isConfigured() {
        return enabled && StringUtils.hasText(authKey);
    }

    private String getAccessToken() throws Exception {
        long now = System.currentTimeMillis();
        if (StringUtils.hasText(accessToken) && tokenExpiresAtMillis - 60_000 > now) {
            return accessToken;
        }

        synchronized (this) {
            now = System.currentTimeMillis();
            if (StringUtils.hasText(accessToken) && tokenExpiresAtMillis - 60_000 > now) {
                return accessToken;
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            headers.set("RqUID", UUID.randomUUID().toString());
            headers.set(HttpHeaders.AUTHORIZATION, authKey.startsWith("Basic ") ? authKey : "Basic " + authKey);

            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("scope", scope);

            ResponseEntity<String> response = restTemplate.exchange(
                    oauthUrl,
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    String.class
            );

            JsonNode root = objectMapper.readTree(response.getBody());
            accessToken = root.path("access_token").asText();
            long expiresAt = root.path("expires_at").asLong(0);
            tokenExpiresAtMillis = expiresAt < 10_000_000_000L ? expiresAt * 1000 : expiresAt;

            if (!StringUtils.hasText(accessToken)) {
                throw new IllegalStateException("GigaChat did not return access_token");
            }
            return accessToken;
        }
    }

    private WeatherDto.PackingRecommendations parseRecommendations(String content) throws Exception {
        JsonNode root = objectMapper.readTree(extractJson(content));

        List<String> essentials = readStringList(root.path("essentials"));
        List<String> clothing = readStringList(root.path("clothing"));
        List<String> weatherGear = readStringList(root.path("weatherGear"));
        List<String> accessories = readStringList(root.path("accessories"));
        String weatherSummary = root.path("weatherSummary").asText("");
        String bestTimeToVisit = root.path("bestTimeToVisit").asText("");

        if (essentials.isEmpty() || clothing.isEmpty() || weatherGear.isEmpty() || accessories.isEmpty()
                || weatherSummary.isBlank() || bestTimeToVisit.isBlank()) {
            throw new IllegalArgumentException("GigaChat response has an unexpected packing format");
        }

        return WeatherDto.PackingRecommendations.builder()
                .essentials(essentials)
                .clothing(clothing)
                .weatherGear(weatherGear)
                .accessories(accessories)
                .weatherSummary(weatherSummary)
                .bestTimeToVisit(bestTimeToVisit)
                .build();
    }

    private List<String> readStringList(JsonNode node) {
        List<String> values = new ArrayList<>();
        if (!node.isArray()) {
            return values;
        }
        for (JsonNode item : node) {
            String value = item.asText("").trim();
            if (!value.isBlank()) {
                values.add(value);
            }
        }
        return values;
    }

    private String extractJson(String content) {
        if (content == null) {
            throw new IllegalArgumentException("Empty GigaChat response");
        }

        String cleaned = content
                .replace("```json", "")
                .replace("```", "")
                .trim();
        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalArgumentException("GigaChat response does not contain JSON");
        }
        return cleaned.substring(start, end + 1);
    }

    private String systemPrompt() {
        return """
                Ты помощник сервиса Travel Diary. Составляй практичный список вещей для поездки по прогнозу погоды.
                Верни только валидный JSON без markdown и пояснений.
                Формат ответа:
                {
                  "essentials": ["..."],
                  "clothing": ["..."],
                  "weatherGear": ["..."],
                  "accessories": ["..."],
                  "weatherSummary": "...",
                  "bestTimeToVisit": "..."
                }
                В каждом массиве должно быть от 3 до 6 коротких пунктов на русском языке.
                """;
    }

    private String buildWeatherPrompt(WeatherDto.WeeklyForecast forecast, String tripTitle) {
        StringBuilder days = new StringBuilder();
        for (WeatherDto.DailyForecast day : forecast.getDays()) {
            days.append("- ")
                    .append(day.getDate())
                    .append(": ")
                    .append(day.getDescription())
                    .append(", от ")
                    .append(day.getTempMin())
                    .append(" до ")
                    .append(day.getTempMax())
                    .append(" °C, осадки ")
                    .append(day.getPrecipitation())
                    .append(" мм, ветер ")
                    .append(day.getWindSpeed())
                    .append(" м/с\n");
        }

        return """
                Поездка: %s
                Место: %s
                Прогноз на ближайшие дни:
                %s

                Подбери список вещей именно под эту погоду. Учитывай дождь, жару, холод, ветер и общие вещи для путешествия.
                """.formatted(
                StringUtils.hasText(tripTitle) ? tripTitle : "поездка",
                forecast.getLocationName(),
                days
        );
    }

    private String normalizedBaseUrl() {
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }
}
