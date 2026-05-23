package com.traveldiary.service;

import com.traveldiary.dto.PlaceDto;
import com.traveldiary.entity.Place;
import com.traveldiary.entity.Trip;
import com.traveldiary.exception.ResourceNotFoundException;
import com.traveldiary.repository.PlaceRepository;
import com.traveldiary.repository.TripRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PlaceService {

    private final PlaceRepository placeRepository;
    private final TripRepository tripRepository;
    private final TripService tripService;

    public List<PlaceDto.Response> getPlacesByTrip(Long tripId, Long userId) {
        findTripAndCheckAccess(tripId, userId);
        return placeRepository.findByTripId(tripId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<PlaceDto.Response> getPlacesByTripAndCategory(
            Long tripId, Long userId, Place.Category category) {
        findTripAndCheckAccess(tripId, userId);
        return placeRepository.findByTripIdAndCategory(tripId, category)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public PlaceDto.Response createPlace(Long tripId, PlaceDto.CreateRequest request, Long userId) {
        Trip trip = findTripAndCheckAccess(tripId, userId);

        Place place = Place.builder()
                .name(request.getName())
                .description(request.getDescription())
                .address(request.getAddress())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .category(request.getCategory())
                .rating(request.getRating())
                .visitedAt(request.getVisitedAt())
                .wishlist(request.isWishlist())
                .mapboxPlaceId(request.getMapboxPlaceId())
                .trip(trip)
                .build();

        return toResponse(placeRepository.save(place));
    }

    @Transactional
    public PlaceDto.Response updatePlace(Long tripId, Long placeId, PlaceDto.UpdateRequest request, Long userId) {
        findTripAndCheckAccess(tripId, userId);
        Place place = findPlaceAndCheckOwner(placeId, userId);
        if (!place.getTrip().getId().equals(tripId)) {
            throw new ResourceNotFoundException("Place", placeId);
        }

        if (request.getName() != null)
            place.setName(request.getName());
        if (request.getDescription() != null)
            place.setDescription(request.getDescription());
        if (request.getAddress() != null)
            place.setAddress(request.getAddress());
        if (request.getLatitude() != null)
            place.setLatitude(request.getLatitude());
        if (request.getLongitude() != null)
            place.setLongitude(request.getLongitude());
        if (request.getCategory() != null)
            place.setCategory(request.getCategory());
        if (request.getRating() != null)
            place.setRating(request.getRating());
        if (request.getVisitedAt() != null)
            place.setVisitedAt(request.getVisitedAt());
        if (request.getWishlist() != null)
            place.setWishlist(request.getWishlist());

        return toResponse(placeRepository.save(place));
    }

    @Transactional
    public void deletePlace(Long tripId, Long placeId, Long userId) {
        findTripAndCheckAccess(tripId, userId);
        Place place = findPlaceAndCheckOwner(placeId, userId);
        if (!place.getTrip().getId().equals(tripId)) {
            throw new ResourceNotFoundException("Place", placeId);
        }
        placeRepository.delete(place);
    }

    private Trip findTripAndCheckAccess(Long tripId, Long userId) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Trip", tripId));
        if (!trip.getUser().getId().equals(userId)) {
            throw new ResourceNotFoundException("Trip", tripId);
        }
        return trip;
    }

    private Place findPlaceAndCheckOwner(Long placeId, Long userId) {
        Place place = placeRepository.findById(placeId)
                .orElseThrow(() -> new ResourceNotFoundException("Place", placeId));
        if (!place.getTrip().getUser().getId().equals(userId)) {
            throw new ResourceNotFoundException("Place", placeId);
        }
        return place;
    }

    private PlaceDto.Response toResponse(Place place) {
        return PlaceDto.Response.builder()
                .id(place.getId())
                .name(place.getName())
                .description(place.getDescription())
                .address(place.getAddress())
                .latitude(place.getLatitude())
                .longitude(place.getLongitude())
                .category(place.getCategory())
                .rating(place.getRating())
                .visitedAt(place.getVisitedAt())
                .wishlist(place.isWishlist())
                .mapboxPlaceId(place.getMapboxPlaceId())
                .tripId(place.getTrip().getId())
                .createdAt(place.getCreatedAt())
                .build();
    }

    public List<PlaceDto.Response> getPublicTripPlaces(String shareToken) {
        Trip trip = tripService.getPublicTripEntity(shareToken);
        return placeRepository.findByTripId(trip.getId())
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }
}
