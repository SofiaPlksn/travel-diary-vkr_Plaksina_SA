package com.traveldiary.service;

import com.traveldiary.dto.AnalyticsDto;
import com.traveldiary.entity.JournalEntry;
import com.traveldiary.entity.Media;
import com.traveldiary.entity.Place;
import com.traveldiary.entity.Trip;

import com.traveldiary.repository.TripRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final TripRepository tripRepository;

    public AnalyticsDto.UserAnalytics getUserAnalytics(Long userId) {
        List<Trip> allTrips = tripRepository
                .findByUserIdOrderByStartDateDesc(userId, Pageable.unpaged())
                .getContent();

        long totalMedia = allTrips.stream().mapToLong(t -> t.getMedia().size()).sum();
        long totalPlaces = allTrips.stream().mapToLong(t -> t.getPlaces().size()).sum();
        long totalJournal = allTrips.stream().mapToLong(t -> t.getJournalEntries().size()).sum();

        long completedTrips = allTrips.stream().filter(t -> t.getStatus() == Trip.Status.COMPLETED).count();
        long activeTrips = allTrips.stream().filter(t -> t.getStatus() == Trip.Status.ACTIVE).count();
        long plannedTrips = allTrips.stream().filter(t -> t.getStatus() == Trip.Status.PLANNED).count();

        long totalTripDays = allTrips.stream().mapToLong(t -> {
            if (t.getStartDate() != null && t.getEndDate() != null) {
                return java.time.temporal.ChronoUnit.DAYS.between(t.getStartDate(), t.getEndDate()) + 1;
            }
            return 1L;
        }).sum();

        Set<String> countries = allTrips.stream()
                .filter(t -> t.getStatus() == Trip.Status.COMPLETED)
                .map(Trip::getCountry).filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Set<String> cities = allTrips.stream()
                .filter(t -> t.getStatus() == Trip.Status.COMPLETED)
                .map(Trip::getCity).filter(Objects::nonNull)
                .collect(Collectors.toSet());

        List<Place> allPlaces = allTrips.stream().flatMap(t -> t.getPlaces().stream()).toList();
        Map<Place.Category, Long> categoryStats = allPlaces.stream()
                .collect(Collectors.groupingBy(Place::getCategory, Collectors.counting()));

        List<AnalyticsDto.CountryStat> topCountries = buildTopCountries(allTrips);
        Map<String, Long> monthlyStats = buildMonthlyStats(allTrips);


        List<AnalyticsDto.Achievement> achievements = calculateAchievements(allTrips);
        long unlocked = achievements.stream().filter(AnalyticsDto.Achievement::isUnlocked).count();

        return AnalyticsDto.UserAnalytics.builder()
                .totalTrips(allTrips.size())
                .completedTrips(completedTrips).activeTrips(activeTrips).plannedTrips(plannedTrips)
                .totalPlaces(totalPlaces).totalMedia(totalMedia)
                .totalJournalEntries(totalJournal).totalTripDays(totalTripDays)
                .countriesVisited(countries.size()).citiesVisited(cities.size())
                .visitedCountries(new ArrayList<>(countries))
                .hotelsCount(categoryStats.getOrDefault(Place.Category.HOTEL, 0L))
                .restaurantsCount(categoryStats.getOrDefault(Place.Category.RESTAURANT, 0L))
                .attractionsCount(categoryStats.getOrDefault(Place.Category.ATTRACTION, 0L))
                .museumsCount(categoryStats.getOrDefault(Place.Category.MUSEUM, 0L))
                .achievements(achievements)
                .unlockedAchievementsCount(unlocked).totalAchievementsCount(achievements.size())
                .topCountries(topCountries).monthlyStats(monthlyStats)
                .build();
    }

    private List<AnalyticsDto.Achievement> calculateAchievements(List<Trip> allTrips) {
        List<LocalDateTime> tripDates = allTrips.stream()
                .map(Trip::getCreatedAt).filter(Objects::nonNull).sorted().collect(Collectors.toList());

        List<LocalDateTime> completedTripDates = allTrips.stream()
                .filter(t -> t.getStatus() == Trip.Status.COMPLETED)
                .map(Trip::getCreatedAt).filter(Objects::nonNull).sorted().collect(Collectors.toList());

        List<LocalDateTime> countryDates = allTrips.stream()
                .filter(t -> t.getStatus() == Trip.Status.COMPLETED)
                .filter(t -> t.getCountry() != null && t.getCreatedAt() != null)
                .collect(Collectors.groupingBy(Trip::getCountry,
                        Collectors.minBy(Comparator.comparing(Trip::getCreatedAt))))
                .values().stream()
                .filter(Optional::isPresent).map(opt -> opt.get().getCreatedAt())
                .sorted().collect(Collectors.toList());
        int countriesCount = countryDates.size();

        List<LocalDateTime> mediaDates = allTrips.stream()
                .flatMap(t -> t.getMedia().stream())
                .map(Media::getCreatedAt).filter(Objects::nonNull).sorted().collect(Collectors.toList());

        List<LocalDateTime> journalDates = allTrips.stream()
                .flatMap(t -> t.getJournalEntries().stream())
                .map(JournalEntry::getCreatedAt).filter(Objects::nonNull).sorted().collect(Collectors.toList());

        List<LocalDateTime> placeDates = allTrips.stream()
                .flatMap(t -> t.getPlaces().stream())
                .map(Place::getCreatedAt).filter(Objects::nonNull).sorted().collect(Collectors.toList());

        List<AnalyticsDto.Achievement> result = new ArrayList<>();

        result.add(buildAchievement("FIRST_TRIP", "\u2728", "Первый шаг", "Создайте свою первую поездку",
                tripDates.size(), 1, getNthDate(tripDates, 1)));
        result.add(buildAchievement("FIVE_TRIPS", "\uD83C\uDF92", "Путешественник", "Совершите 5 поездок",
                completedTripDates.size(), 5, getNthDate(completedTripDates, 5)));
        result.add(buildAchievement("TEN_TRIPS", "\uD83D\uDEEB", "Исследователь", "Совершите 10 поездок",
                completedTripDates.size(), 10, getNthDate(completedTripDates, 10)));
        result.add(buildAchievement("FIRST_COUNTRY", "\uD83D\uDDFA\uFE0F", "Первооткрыватель", "Посетите первую страну",
                countriesCount, 1, getNthDate(countryDates, 1)));
        result.add(buildAchievement("FIVE_COUNTRIES", "\uD83C\uDF10", "Гражданин мира", "Посетите 5 разных стран",
                countriesCount, 5, getNthDate(countryDates, 5)));
        result.add(buildAchievement("TEN_COUNTRIES", "\uD83C\uDFC5", "Мировой странник", "Посетите 10 разных стран",
                countriesCount, 10, getNthDate(countryDates, 10)));
        result.add(buildAchievement("TWENTY_COUNTRIES", "\uD83D\uDC51", "Легенда путешествий", "Посетите 20 разных стран",
                countriesCount, 20, getNthDate(countryDates, 20)));
        result.add(buildAchievement("FIRST_MEDIA", "\uD83D\uDCF8", "Медиа-мастер", "Загрузите первый медиафайл",
                mediaDates.size(), 1, getNthDate(mediaDates, 1)));
        result.add(buildAchievement("HUNDRED_MEDIA", "\uD83D\uDDBC\uFE0F", "Медиа-художник", "Загрузите 100 медиафайлов",
                mediaDates.size(), 100, getNthDate(mediaDates, 100)));
        result.add(buildAchievement("FIRST_JOURNAL", "\uD83D\uDD8B\uFE0F", "Дневниковый автор", "Напишите первую запись в дневнике",
                journalDates.size(), 1, getNthDate(journalDates, 1)));
        result.add(buildAchievement("TEN_JOURNALS", "\uD83D\uDCDA", "Летописец", "Напишите 10 записей в дневнике",
                journalDates.size(), 10, getNthDate(journalDates, 10)));
        result.add(buildAchievement("FIFTY_PLACES", "\uD83D\uDC8E", "Коллекционер мест", "Добавьте 50 мест",
                placeDates.size(), 50, getNthDate(placeDates, 50)));
        result.add(buildAchievement("GLOBE_TROTTER", "\uD83C\uDF0F", "Кругосветчик", "Посетите страны на 3 разных континентах",
                Math.min(countriesCount / 3, 3), 3, getNthDate(countryDates, 9)));

        return result;
    }

    private LocalDateTime getNthDate(List<LocalDateTime> sortedDates, int n) {
        return sortedDates.size() >= n ? sortedDates.get(n - 1) : null;
    }

    private AnalyticsDto.Achievement buildAchievement(
            String id, String emoji, String title, String description,
            int current, int target, LocalDateTime unlockedAt) {
        boolean unlocked = current >= target;
        return AnalyticsDto.Achievement.builder()
                .id(id).emoji(emoji).title(title).description(description)
                .unlocked(unlocked).unlockedAt(unlocked ? unlockedAt : null)
                .progress(Math.min(current, target)).target(target)
                .build();
    }

    private List<AnalyticsDto.CountryStat> buildTopCountries(List<Trip> trips) {
        return trips.stream()
                .filter(t -> t.getCountry() != null)
                .collect(Collectors.groupingBy(Trip::getCountry))
                .entrySet().stream()
                .map(entry -> {
                    List<Trip> countryTrips = entry.getValue();
                    long totalPlaces = countryTrips.stream().mapToLong(t -> t.getPlaces().size()).sum();
                    long totalMedia = countryTrips.stream().mapToLong(t -> t.getMedia().size()).sum();
                    return AnalyticsDto.CountryStat.builder()
                            .country(entry.getKey()).tripsCount(countryTrips.size())
                            .placesCount(totalPlaces).mediaCount(totalMedia).build();
                })
                .sorted(Comparator.comparingLong(AnalyticsDto.CountryStat::getTripsCount).reversed())
                .limit(5)
                .collect(Collectors.toList());
    }

    private Map<String, Long> buildMonthlyStats(List<Trip> trips) {
        Map<String, Long> stats = new LinkedHashMap<>();
        LocalDate now = LocalDate.now();
        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("MMM", new Locale("ru"));

        for (int i = 11; i >= 0; i--) {
            LocalDate monthDate = now.minusMonths(i);
            String monthName = monthDate.format(formatter);
            if (monthName.endsWith(".")) {
                monthName = monthName.substring(0, monthName.length() - 1);
            }
            monthName = monthName.substring(0, 1).toUpperCase() + monthName.substring(1);

            final int targetMonth = monthDate.getMonthValue();
            final int targetYear = monthDate.getYear();

            long count = trips.stream()
                    .filter(t -> t.getStartDate() != null)
                    .filter(t -> t.getStartDate().getMonthValue() == targetMonth && t.getStartDate().getYear() == targetYear)
                    .count();

            stats.put(monthName, count);
        }
        return stats;
    }

    public AnalyticsDto.GlobalMapData getGlobalMapData(Long userId) {
        List<Trip> allTrips = tripRepository
                .findByUserIdOrderByStartDateDesc(userId, Pageable.unpaged())
                .getContent();

        List<AnalyticsDto.MapPoint> points = new ArrayList<>();

        for (Trip trip : allTrips) {
            if (trip.getStatus() == Trip.Status.PLANNED) continue;

            if (trip.getPlaces() != null) {
                for (Place place : trip.getPlaces()) {
                    if (place.getLatitude() != null && place.getLongitude() != null) {
                        points.add(AnalyticsDto.MapPoint.builder()
                                .id("PLACE_" + place.getId()).type("PLACE")
                                .lat(place.getLatitude()).lng(place.getLongitude())
                                .title(place.getName())
                                .tripId(trip.getId()).tripTitle(trip.getTitle())
                                .build());
                    }
                }
            }

            if (trip.getMedia() != null) {
                for (Media media : trip.getMedia()) {
                    if (media.getExifLatitude() != null && media.getExifLongitude() != null) {
                        points.add(AnalyticsDto.MapPoint.builder()
                                .id("MEDIA_" + media.getId()).type("MEDIA")
                                .lat(media.getExifLatitude()).lng(media.getExifLongitude())
                                .title(media.getCaption() != null ? media.getCaption() : media.getOriginalFileName())
                                .thumbnailUrl(media.getThumbnailPath() != null ? media.getThumbnailPath() : media.getFilePath())
                                .tripId(trip.getId()).tripTitle(trip.getTitle())
                                .build());
                    }
                }
            }
        }

        log.debug("Found {} map points for user {}", points.size(), userId);
        return AnalyticsDto.GlobalMapData.builder().points(points).build();
    }
}
