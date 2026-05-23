package com.traveldiary.service;

import com.traveldiary.dto.TripDto;
import com.traveldiary.entity.Tag;
import com.traveldiary.entity.Trip;
import com.traveldiary.entity.User;
import com.traveldiary.exception.ResourceNotFoundException;

import com.traveldiary.repository.TagRepository;
import com.traveldiary.repository.TripRepository;
import com.traveldiary.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TripService {

    private final TripRepository tripRepository;
    private final UserRepository userRepository;
    private final TagRepository tagRepository;

    public Page<TripDto.Summary> getUserTrips(Long userId, String search, Trip.Status status, Integer year, Pageable pageable) {
        if (search != null && search.trim().isEmpty()) {
            search = null;
        }
        return tripRepository.searchUserTrips(userId, search, status, year, pageable)
                .map(this::toSummary);
    }

    public List<Integer> getTripYears(Long userId) {
        return tripRepository.findDistinctYearsByUserId(userId);
    }

    public TripDto.Response getTripById(Long tripId, Long requestingUserId) {
        Trip trip = findTripOrThrow(tripId);
        if (!trip.getUser().getId().equals(requestingUserId)
                && trip.getVisibility() == Trip.Visibility.PRIVATE) {
            throw new ResourceNotFoundException("Trip", tripId);
        }
        return toResponse(trip);
    }

    @Transactional
    public TripDto.Response createTrip(TripDto.CreateRequest request, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        Trip trip = Trip.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .country(request.getCountry())
                .city(request.getCity())
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .visibility(request.getVisibility() != null ? request.getVisibility() : Trip.Visibility.PRIVATE)
                .status(request.getStatus() != null ? request.getStatus() : Trip.Status.PLANNED)
                .user(user)
                .tags(resolveOrCreateTags(request.getTags()))
                .build();

        if (trip.getVisibility() != Trip.Visibility.PRIVATE) {
            trip.setShareToken("trip-" + UUID.randomUUID().toString().substring(0, 8));
        }

        return toResponse(tripRepository.save(trip));
    }

    @Transactional
    public TripDto.Response updateTrip(Long tripId, TripDto.UpdateRequest request, Long userId) {
        Trip trip = findTripAndCheckOwner(tripId, userId);

        if (request.getTitle() != null) trip.setTitle(request.getTitle());
        if (request.getDescription() != null) trip.setDescription(request.getDescription());
        if (request.getCountry() != null) trip.setCountry(request.getCountry());
        if (request.getCity() != null) trip.setCity(request.getCity());
        if (request.getStartDate() != null) trip.setStartDate(request.getStartDate());
        if (request.getEndDate() != null) trip.setEndDate(request.getEndDate());
        if (request.getCoverImageUrl() != null) trip.setCoverImageUrl(request.getCoverImageUrl());
        if (request.getStatus() != null) trip.setStatus(request.getStatus());
        if (request.getTags() != null) trip.setTags(resolveOrCreateTags(request.getTags()));

        if (request.getVisibility() != null && !request.getVisibility().equals(trip.getVisibility())) {
            trip.setVisibility(request.getVisibility());
            if (trip.getShareToken() == null && request.getVisibility() != Trip.Visibility.PRIVATE) {
                trip.setShareToken("trip-" + UUID.randomUUID().toString().substring(0, 8));
            }
            trip.setShareTokenExpiry(null);
        }

        return toResponse(tripRepository.save(trip));
    }

    @Transactional
    public void deleteTrip(Long tripId, Long userId) {
        Trip trip = findTripAndCheckOwner(tripId, userId);
        tripRepository.delete(trip);
    }

    @Transactional
    public String generateShareLink(Long tripId, Long userId, Integer expiryHours) {
        Trip trip = findTripAndCheckOwner(tripId, userId);
        trip.setShareToken("trip-" + UUID.randomUUID().toString().substring(0, 8));
        trip.setVisibility(Trip.Visibility.LINK_ONLY);
        trip.setShareTokenExpiry(expiryHours != null && expiryHours > 0
                ? LocalDateTime.now().plusHours(expiryHours)
                : null);
        tripRepository.save(trip);
        return trip.getShareToken();
    }

    public TripDto.Response getPublicTrip(String shareToken) {
        Trip trip = tripRepository.findByShareToken(shareToken)
                .orElseThrow(() -> new ResourceNotFoundException("Поездка по ссылке не найдена"));
        ensurePublicTripAvailable(trip);
        return toResponse(trip);
    }

    @Transactional(readOnly = true)
    public Trip getTripEntityForOwner(Long tripId, Long userId) {
        return findTripAndCheckOwner(tripId, userId);
    }

    @Transactional(readOnly = true)
    public Trip getPublicTripEntity(String shareToken) {
        Trip trip = tripRepository.findByShareToken(shareToken)
                .orElseThrow(() -> new ResourceNotFoundException("Поездка по ссылке не найдена"));
        ensurePublicTripAvailable(trip);
        return trip;
    }

    private void ensurePublicTripAvailable(Trip trip) {
        if (trip.getVisibility() == Trip.Visibility.PRIVATE || isShareTokenExpired(trip)) {
            throw new ResourceNotFoundException("Поездка недоступна");
        }
    }

    private boolean isShareTokenExpired(Trip trip) {
        return trip.getShareTokenExpiry() != null
                && !trip.getShareTokenExpiry().isAfter(LocalDateTime.now());
    }

    public List<TripDto.Summary> getMemoriesOnThisDay(Long userId) {
        LocalDate today = LocalDate.now();
        return tripRepository.findMemoriesOnThisDay(userId, today.getMonthValue(), today.getDayOfMonth(), today.getYear())
                .stream()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    private Set<Tag> resolveOrCreateTags(List<String> tagNames) {
        if (tagNames == null || tagNames.isEmpty()) return new HashSet<>();

        Set<String> normalizedNames = tagNames.stream()
                .filter(name -> name != null && !name.isBlank())
                .map(name -> name.trim().toLowerCase())
                .collect(Collectors.toSet());

        if (normalizedNames.isEmpty()) return new HashSet<>();

        Set<Tag> tags = new HashSet<>(tagRepository.findByNameIn(normalizedNames));
        Set<String> existingNames = tags.stream()
                .map(Tag::getName)
                .collect(Collectors.toSet());

        normalizedNames.stream()
                .filter(name -> !existingNames.contains(name))
                .map(name -> Tag.builder().name(name).build())
                .map(tagRepository::save)
                .forEach(tags::add);

        return tags;
    }

    private Trip findTripOrThrow(Long tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Trip", tripId));
    }

    private Trip findTripAndCheckOwner(Long tripId, Long userId) {
        Trip trip = findTripOrThrow(tripId);
        if (!trip.getUser().getId().equals(userId)) {

            throw new ResourceNotFoundException("Trip", tripId);
        }
        return trip;
    }

    private TripDto.Response toResponse(Trip trip) {
        Set<String> tagNames = trip.getTags().stream().map(Tag::getName).collect(Collectors.toSet());
        return TripDto.Response.builder()
                .id(trip.getId()).title(trip.getTitle()).description(trip.getDescription())
                .country(trip.getCountry()).city(trip.getCity())
                .startDate(trip.getStartDate()).endDate(trip.getEndDate())
                .coverImageUrl(trip.getCoverImageUrl()).visibility(trip.getVisibility())
                .status(trip.getStatus()).shareToken(trip.getShareToken())
                .shareTokenExpiry(trip.getShareTokenExpiry())
                .placesCount(trip.getPlaces().size()).mediaCount(trip.getMedia().size())
                .journalEntriesCount(trip.getJournalEntries().size())
                .tags(tagNames).userId(trip.getUser().getId()).userName(trip.getUser().getName())
                .createdAt(trip.getCreatedAt()).updatedAt(trip.getUpdatedAt())
                .build();
    }

    private TripDto.Summary toSummary(Trip trip) {
        Set<String> tagNames = trip.getTags().stream().map(Tag::getName).collect(Collectors.toSet());
        return TripDto.Summary.builder()
                .id(trip.getId()).title(trip.getTitle())
                .country(trip.getCountry()).city(trip.getCity())
                .startDate(trip.getStartDate()).endDate(trip.getEndDate())
                .coverImageUrl(trip.getCoverImageUrl()).status(trip.getStatus())
                .visibility(trip.getVisibility())
                .placesCount(trip.getPlaces().size()).mediaCount(trip.getMedia().size())
                .tags(tagNames)
                .build();
    }
}
