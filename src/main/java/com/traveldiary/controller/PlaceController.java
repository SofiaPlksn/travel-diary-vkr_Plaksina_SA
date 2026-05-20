package com.traveldiary.controller;

import com.traveldiary.dto.PlaceDto;
import com.traveldiary.entity.Place;
import com.traveldiary.entity.User;
import com.traveldiary.service.PlaceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class PlaceController {

    private final PlaceService placeService;

    @GetMapping("/api/trips/{tripId}/places")
    public ResponseEntity<List<PlaceDto.Response>> getPlaces(
            @PathVariable Long tripId,
            @RequestParam(required = false) Place.Category category,
            @AuthenticationPrincipal User user) {
        List<PlaceDto.Response> places = category != null
                ? placeService.getPlacesByTripAndCategory(tripId, user.getId(), category)
                : placeService.getPlacesByTrip(tripId, user.getId());
        return ResponseEntity.ok(places);
    }

    @PostMapping("/api/trips/{tripId}/places")
    public ResponseEntity<PlaceDto.Response> createPlace(
            @PathVariable Long tripId,
            @Valid @RequestBody PlaceDto.CreateRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(placeService.createPlace(tripId, request, user.getId()));
    }

    @PutMapping("/api/trips/{tripId}/places/{placeId}")
    public ResponseEntity<PlaceDto.Response> updatePlace(
            @PathVariable Long tripId,
            @PathVariable Long placeId,
            @RequestBody PlaceDto.UpdateRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(placeService.updatePlace(tripId, placeId, request, user.getId()));
    }

    @DeleteMapping("/api/trips/{tripId}/places/{placeId}")
    public ResponseEntity<Void> deletePlace(
            @PathVariable Long tripId,
            @PathVariable Long placeId,
            @AuthenticationPrincipal User user) {
        placeService.deletePlace(tripId, placeId, user.getId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/places/nearby")
    public ResponseEntity<List<PlaceDto.Response>> getNearby(
            @RequestParam Double lat,
            @RequestParam Double lng,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(placeService.getNearbyPlaces(user.getId(), lat, lng));
    }
}
