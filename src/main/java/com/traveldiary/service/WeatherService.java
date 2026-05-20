package com.traveldiary.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.traveldiary.dto.WeatherDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class WeatherService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    private static final String GEOCODING_API_URL = "https://geocoding-api.open-meteo.com/v1/search";
    private static final String WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast";
    private static final String WEATHER_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

    @Cacheable(value = "weather", key = "T(Math).round(#lat * 100.0) / 100.0 + '_' + T(Math).round(#lon * 100.0) / 100.0")
    public WeatherDto.WeeklyForecast getWeeklyForecast(Double lat, Double lon) {
        lat = Math.round(lat * 100.0) / 100.0;
        lon = Math.round(lon * 100.0) / 100.0;
        log.debug("Cache MISS — fetching from OpenWeatherMap: lat={}, lon={}", lat, lon);
        String json = fetchForecastFromApi(lat, lon);
        WeatherDto.WeeklyForecast forecast = parseForecastFromJson(json, lat, lon);
        forecast.setFromCache(false);
        return forecast;
    }

    @Cacheable(value = "weather", key = "'city_' + #cityName.toLowerCase().trim()")
    public WeatherDto.WeeklyForecast getWeeklyForecastByCity(String cityName) {
        log.debug("Fetching weather for city: {}", cityName);
        double[] coords = geocodeCity(cityName);
        String json = fetchForecastFromApi(coords[0], coords[1]);
        WeatherDto.WeeklyForecast forecast = parseForecastFromJson(json, coords[0], coords[1]);
        forecast.setFromCache(false);
        return forecast;
    }

    @Cacheable(value = "weather_history", key = "'history_' + #cityName.toLowerCase().trim() + '_' + #date.toString()")
    public WeatherDto.DailyForecast getHistoricalWeatherByCity(String cityName, java.time.LocalDate date) {
        log.debug("Fetching historical weather for city: {} on date: {}", cityName, date);
        double[] coords = geocodeCity(cityName);
        String json = fetchHistoricalWeatherFromApi(coords[0], coords[1], date);
        return parseHistoricalForecastFromJson(json);
    }

    @Cacheable(value = "weather", key = "'packing_city_' + #cityName.toLowerCase().trim()")
    public WeatherDto.PackingRecommendations getPackingRecommendationsByCity(String cityName, String tripTitle) {
        double[] coords = geocodeCity(cityName);
        String json = fetchForecastFromApi(coords[0], coords[1]);
        WeatherDto.WeeklyForecast forecast = parseForecastFromJson(json, coords[0], coords[1]);
        return generatePackingList(forecast);
    }

    @Cacheable(value = "weather", key = "'packing_' + T(Math).round(#lat * 100.0) / 100.0 + '_' + T(Math).round(#lon * 100.0) / 100.0")
    public WeatherDto.PackingRecommendations getPackingRecommendations(Double lat, Double lon, String tripTitle) {
        lat = Math.round(lat * 100.0) / 100.0;
        lon = Math.round(lon * 100.0) / 100.0;
        String json = fetchForecastFromApi(lat, lon);
        WeatherDto.WeeklyForecast forecast = parseForecastFromJson(json, lat, lon);
        return generatePackingList(forecast);
    }

    public double[] geocodeCity(String query) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent", "TravelDiaryApp/1.0 contact@traveldiary.app");
        headers.set("Accept-Language", "ru,en;q=0.9");
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        try {
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
            URI uri = UriComponentsBuilder.fromHttpUrl(GEOCODING_API_URL)
                    .queryParam("name", encodedQuery)
                    .queryParam("count", 3).queryParam("language", "ru").queryParam("format", "json")
                    .build(true).toUri();
            ResponseEntity<String> resp = restTemplate.exchange(uri, HttpMethod.GET, entity, String.class);
            JsonNode root = objectMapper.readTree(resp.getBody());
            JsonNode results = root.path("results");
            if (!results.isEmpty()) {
                double lat = results.get(0).path("latitude").asDouble();
                double lon = results.get(0).path("longitude").asDouble();
                log.debug("Geocoded '{}' -> lat={}, lon={}", query, lat, lon);
                return new double[] { lat, lon };
            }
            throw new RuntimeException("Город «" + query + "» не найден. Уточните название.");
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("Geocoding error for '{}': {}", query, e.getMessage());
            throw new RuntimeException("Ошибка геокодирования: " + e.getMessage());
        }
    }

    public List<WeatherDto.GeocodeSuggestion> autocompleteAddress(String query) {
        try {
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
            URI uri = UriComponentsBuilder.fromHttpUrl(GEOCODING_API_URL)
                    .queryParam("name", encodedQuery)
                    .queryParam("count", 7).queryParam("language", "ru").queryParam("format", "json")
                    .build(true).toUri();
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "TravelDiaryApp/1.0 contact@traveldiary.app");
            headers.set("Accept-Language", "ru,en;q=0.9");
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<String> resp = restTemplate.exchange(uri, HttpMethod.GET, entity, String.class);
            JsonNode root = objectMapper.readTree(resp.getBody());
            JsonNode results = root.path("results");
            List<WeatherDto.GeocodeSuggestion> suggestions = new ArrayList<>();
            if (results.isArray()) {
                for (JsonNode node : results) {
                    String name = node.path("name").asText("");
                    String admin1 = node.path("admin1").asText("");
                    String country = node.path("country").asText("");

                    List<String> parts = new ArrayList<>();
                    if (!name.isEmpty()) parts.add(name);
                    if (!admin1.isEmpty() && !admin1.equals(name)) parts.add(admin1);
                    if (!country.isEmpty()) parts.add(country);

                    suggestions.add(WeatherDto.GeocodeSuggestion.builder()
                            .displayName(String.join(", ", parts))
                            .lat(node.path("latitude").asDouble())
                            .lon(node.path("longitude").asDouble())
                            .build());
                }
            }
            return suggestions;
        } catch (Exception e) {
            log.error("Autocomplete error for '{}': {}", query, e.getMessage());
            return new ArrayList<>();
        }
    }

    private String firstNonEmpty(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return "";
    }

    @CacheEvict(value = "weather", key = "T(Math).round(#lat * 100.0) / 100.0 + '_' + T(Math).round(#lon * 100.0) / 100.0")
    public void evictWeatherCache(Double lat, Double lon) {
        log.info("Weather cache evicted for lat={}, lon={}", lat, lon);
    }

    @Scheduled(cron = "0 0 */3 * * *")
    @CacheEvict(value = "weather", allEntries = true)
    public void evictAllWeatherCache() {
        log.info("All weather cache cleared by scheduler");
    }

    private String fetchForecastFromApi(Double lat, Double lon) {
        URI uri = UriComponentsBuilder.fromHttpUrl(WEATHER_API_URL)
                .queryParam("latitude", lat).queryParam("longitude", lon)
                .queryParam("daily", "weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max")
                .queryParam("current", "temperature_2m,relative_humidity_2m")
                .queryParam("timezone", "auto")
                .build().toUri();
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "TravelDiaryApp/1.0 contact@traveldiary.app");
            headers.set("Accept-Language", "ru,en;q=0.9");
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            return restTemplate.exchange(uri, HttpMethod.GET, entity, String.class).getBody();
        } catch (Exception e) {
            log.error("Weather API error: {}", e.getMessage());
            throw new RuntimeException("Не удалось получить данные о погоде.");
        }
    }

    private String fetchHistoricalWeatherFromApi(Double lat, Double lon, java.time.LocalDate date) {
        URI uri = UriComponentsBuilder.fromHttpUrl(WEATHER_ARCHIVE_URL)
                .queryParam("latitude", lat).queryParam("longitude", lon)
                .queryParam("start_date", date.toString()).queryParam("end_date", date.toString())
                .queryParam("daily", "weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum")
                .queryParam("timezone", "auto")
                .build().toUri();
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "TravelDiaryApp/1.0 contact@traveldiary.app");
            headers.set("Accept-Language", "ru,en;q=0.9");
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            return restTemplate.exchange(uri, HttpMethod.GET, entity, String.class).getBody();
        } catch (Exception e) {
            log.error("Historical Weather API error: {}", e.getMessage());
            throw new RuntimeException("Не удалось получить исторические данные о погоде.");
        }
    }

    private WeatherDto.WeeklyForecast parseForecastFromJson(String json, Double lat, Double lon) {
        try {
            JsonNode root = objectMapper.readTree(json);
            String locationName = getCityNameIfPossible(lat, lon);

            List<WeatherDto.DailyForecast> days = new ArrayList<>();

            JsonNode daily = root.path("daily");
            JsonNode timeArray = daily.path("time");
            JsonNode maxTempArray = daily.path("temperature_2m_max");
            JsonNode minTempArray = daily.path("temperature_2m_min");
            JsonNode precipArray = daily.path("precipitation_sum");
            JsonNode windArray = daily.path("windspeed_10m_max");
            JsonNode weatherCodeArray = daily.path("weathercode");

            JsonNode current = root.path("current");
            double currentTemp = current.path("temperature_2m").asDouble();
            int currentHumidity = current.path("relative_humidity_2m").asInt();

            for (int i = 0; i < timeArray.size(); i++) {
                String date = timeArray.get(i).asText();
                double tempMax = maxTempArray.get(i).asDouble();
                double tempMin = minTempArray.get(i).asDouble();
                double precip = precipArray.get(i).asDouble();
                double wind = windArray.get(i).asDouble() / 3.6;
                int code = weatherCodeArray.get(i).asInt();

                WeatherCodeInfo info = getWeatherInfo(code);

                double displayCurrentTemp = i == 0 ? currentTemp : (tempMax + tempMin) / 2.0;

                days.add(WeatherDto.DailyForecast.builder()
                        .date(date)
                        .tempMax(Math.round(tempMax * 10.0) / 10.0)
                        .tempMin(Math.round(tempMin * 10.0) / 10.0)
                        .tempCurrent(Math.round(displayCurrentTemp * 10.0) / 10.0)
                        .humidity(i == 0 ? currentHumidity : 50)
                        .windSpeed(Math.round(wind * 10.0) / 10.0)
                        .description(info.description)
                        .icon(info.iconCode)
                        .precipitation(Math.round(precip * 10.0) / 10.0)
                        .isRainy(precip > 0.5)
                        .isCold(tempMax < 10.0)
                        .isHot(tempMax > 30.0)
                        .build());
            }

            return WeatherDto.WeeklyForecast.builder()
                    .latitude(lat).longitude(lon)
                    .locationName(locationName)
                    .days(days).fromCache(false)
                    .build();
        } catch (Exception e) {
            log.error("Weather JSON parse error: {}", e.getMessage(), e);
            throw new RuntimeException("Ошибка обработки данных о погоде");
        }
    }

    private WeatherDto.DailyForecast parseHistoricalForecastFromJson(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode daily = root.path("daily");

            String date = daily.path("time").get(0).asText();
            double tempMax = daily.path("temperature_2m_max").get(0).asDouble();
            double tempMin = daily.path("temperature_2m_min").get(0).asDouble();
            double precip = daily.path("precipitation_sum").get(0).asDouble();
            int code = daily.path("weathercode").get(0).asInt();

            WeatherCodeInfo info = getWeatherInfo(code);

            return WeatherDto.DailyForecast.builder()
                    .date(date)
                    .tempMax(Math.round(tempMax * 10.0) / 10.0)
                    .tempMin(Math.round(tempMin * 10.0) / 10.0)
                    .tempCurrent(Math.round(((tempMax + tempMin) / 2.0) * 10.0) / 10.0)
                    .humidity(50).windSpeed(0.0)
                    .description(info.description).icon(info.iconCode)
                    .precipitation(Math.round(precip * 10.0) / 10.0)
                    .isRainy(precip > 0.5).isCold(tempMax < 10.0).isHot(tempMax > 30.0)
                    .build();
        } catch (Exception e) {
            log.error("Historical Weather JSON parse error: {}", e.getMessage(), e);
            throw new RuntimeException("Ошибка обработки исторических данных о погоде");
        }
    }

    private String getCityNameIfPossible(Double lat, Double lon) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "TravelDiaryApp/1.0 (contact@traveldiary.app)");
            headers.set("Accept-Language", "ru,en;q=0.9");
            headers.set("Referer", "https://traveldiary.app");
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            URI uri = UriComponentsBuilder.fromHttpUrl("https://nominatim.openstreetmap.org/reverse")
                    .queryParam("lat", lat).queryParam("lon", lon)
                    .queryParam("format", "json").queryParam("accept-language", "ru")
                    .build().toUri();

            ResponseEntity<String> resp = restTemplate.exchange(uri, HttpMethod.GET, entity, String.class);
            JsonNode root = objectMapper.readTree(resp.getBody());
            JsonNode address = root.path("address");

            String city = firstNonEmpty(
                    address.path("city").asText(""), address.path("town").asText(""),
                    address.path("village").asText(""), address.path("county").asText(""),
                    address.path("state").asText(""));

            return city.isBlank() ? "По координатам" : city;
        } catch (Exception e) {
            log.warn("Failed to reverse geocode coords {}, {}: {}", lat, lon, e.getMessage());
            return "Неизвестно";
        }
    }

    private static class WeatherCodeInfo {
        final String description;
        final String iconCode;
        WeatherCodeInfo(String d, String i) { this.description = d; this.iconCode = i; }
    }

    private WeatherCodeInfo getWeatherInfo(int code) {
        switch (code) {
            case 0: return new WeatherCodeInfo("Ясно", "01d");
            case 1: return new WeatherCodeInfo("В основном ясно", "02d");
            case 2: return new WeatherCodeInfo("Переменная облачность", "03d");
            case 3: return new WeatherCodeInfo("Пасмурно", "04d");
            case 45: case 48: return new WeatherCodeInfo("Туман", "50d");
            case 51: case 53: case 55: return new WeatherCodeInfo("Морось", "09d");
            case 56: case 57: return new WeatherCodeInfo("Ледяная морось", "09d");
            case 61: case 63: case 65: return new WeatherCodeInfo("Дождь", "10d");
            case 66: case 67: return new WeatherCodeInfo("Ледяной дождь", "13d");
            case 71: case 73: case 75: case 77: return new WeatherCodeInfo("Снег", "13d");
            case 80: case 81: case 82: return new WeatherCodeInfo("Ливень", "09d");
            case 85: case 86: return new WeatherCodeInfo("Снегопад", "13d");
            case 95: return new WeatherCodeInfo("Гроза", "11d");
            case 96: case 99: return new WeatherCodeInfo("Гроза с градом", "11d");
            default: return new WeatherCodeInfo("Неизвестно", "03d");
        }
    }

    private WeatherDto.PackingRecommendations generatePackingList(WeatherDto.WeeklyForecast forecast) {
        List<WeatherDto.DailyForecast> days = forecast.getDays();
        boolean hasRain = days.stream().anyMatch(WeatherDto.DailyForecast::isRainy);
        boolean hasCold = days.stream().anyMatch(WeatherDto.DailyForecast::isCold);
        boolean hasHot = days.stream().anyMatch(WeatherDto.DailyForecast::isHot);
        double avgTemp = days.stream().mapToDouble(d -> (d.getTempMax() + d.getTempMin()) / 2).average().orElse(20);
        double maxTemp = days.stream().mapToDouble(WeatherDto.DailyForecast::getTempMax).max().orElse(20);
        double minTemp = days.stream().mapToDouble(WeatherDto.DailyForecast::getTempMin).min().orElse(10);

        List<String> essentials = new ArrayList<>(List.of(
                "Паспорт и документы", "Зарядное устройство", "Наличные и карта",
                "Телефон", "Аптечка", "Страховой полис"));
        List<String> clothing = new ArrayList<>();
        if (hasCold) clothing.addAll(List.of("Тёплая куртка", "Свитер", "Тёплые носки", "Шапка и перчатки"));
        if (hasHot) clothing.addAll(List.of("Лёгкие футболки (3-4 шт.)", "Шорты", "Кепка"));
        if (!hasCold && !hasHot) clothing.addAll(List.of("Футболки (3-4 шт.)", "Лёгкая куртка", "Джинсы", "Кроссовки"));
        if (avgTemp > 15) clothing.add("Сандалии");
        List<String> weatherGear = new ArrayList<>();
        if (hasRain) weatherGear.addAll(List.of("Компактный зонт", "Дождевик", "Водонепроницаемая обувь"));
        if (hasHot) weatherGear.addAll(List.of("Солнцезащитный крем SPF 50+", "Бутылка для воды"));
        if (hasCold) weatherGear.add("Термобельё");
        if (weatherGear.isEmpty()) weatherGear.add("Лёгкий шарф");
        List<String> accessories = new ArrayList<>(List.of("Рюкзак", "Power bank"));

        return WeatherDto.PackingRecommendations.builder()
                .essentials(essentials).clothing(clothing)
                .weatherGear(weatherGear).accessories(accessories)
                .weatherSummary(String.format("Температура: от %.0f°C до %.0f°C%s%s%s.",
                        minTemp, maxTemp,
                        hasRain ? ", возможны дожди" : "",
                        hasCold ? ", прохладно" : "",
                        hasHot ? ", жарко" : ""))
                .bestTimeToVisit(hasHot ? "Активности утром до 11:00 или вечером после 18:00"
                        : hasRain ? "Дождливые дни — для музеев и кафе"
                        : "Погода благоприятная весь день")
                .build();
    }
}
