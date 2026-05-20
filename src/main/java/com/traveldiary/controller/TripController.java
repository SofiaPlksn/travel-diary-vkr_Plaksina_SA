package com.traveldiary.controller;

import com.traveldiary.dto.TripDto;
import com.traveldiary.entity.Trip;
import com.traveldiary.entity.User;
import com.traveldiary.service.TripPdfService;
import com.traveldiary.service.TripService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/trips")
@RequiredArgsConstructor
public class TripController {

    private final TripService tripService;
    private final TripPdfService tripPdfService;

    @GetMapping
    public ResponseEntity<Page<TripDto.Summary>> getMyTrips(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Trip.Status status,
            @RequestParam(required = false) Integer year,
            @PageableDefault(size = 10, sort = "startDate") Pageable pageable
    ) {
        return ResponseEntity.ok(tripService.getUserTrips(user.getId(), search, status, year, pageable));
    }

    @GetMapping("/years")
    public ResponseEntity<List<Integer>> getTripYears(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(tripService.getTripYears(user.getId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TripDto.Response> getTrip(
            @PathVariable Long id,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(tripService.getTripById(id, user.getId()));
    }

    @PostMapping
    public ResponseEntity<TripDto.Response> createTrip(
            @Valid @RequestBody TripDto.CreateRequest request,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(tripService.createTrip(request, user.getId()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TripDto.Response> updateTrip(
            @PathVariable Long id,
            @RequestBody TripDto.UpdateRequest request,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(tripService.updateTrip(id, request, user.getId()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTrip(
            @PathVariable Long id,
            @AuthenticationPrincipal User user
    ) {
        tripService.deleteTrip(id, user.getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/share")
    public ResponseEntity<Map<String, String>> shareTrip(
            @PathVariable Long id,
            @RequestParam(required = false) Integer expiryHours,
            @AuthenticationPrincipal User user
    ) {
        String token = tripService.generateShareLink(id, user.getId(), expiryHours);
        return ResponseEntity.ok(Map.of(
                "shareToken", token,
                "shareUrl", "/share.html?token=" + token
        ));
    }

    @GetMapping("/public/{token}")
    public ResponseEntity<TripDto.Response> getPublicTrip(@PathVariable String token) {
        return ResponseEntity.ok(tripService.getPublicTrip(token));
    }

    @GetMapping("/memories")
    public ResponseEntity<List<TripDto.Summary>> getMemories(
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(tripService.getMemoriesOnThisDay(user.getId()));
    }

    @GetMapping("/stats")
    public ResponseEntity<TripDto.UserStats> getStats(
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(tripService.getUserStats(user.getId()));
    }

    @Transactional(readOnly = true)
    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> downloadPdf(
            @PathVariable Long id,
            @RequestParam(defaultValue = "description,places,journal") String sections,
            @AuthenticationPrincipal User user
    ) {
        Trip trip = tripService.getTripEntityForOwner(id, user.getId());
        Set<String> sectionSet = Set.of(sections.split(","));

        byte[] pdfBytes = tripPdfService.generateTripPdf(
                trip,
                sectionSet.contains("description"),
                sectionSet.contains("places"),
                sectionSet.contains("journal")
        );

        String filename = "trip-" + trip.getTitle()
                .replaceAll("[^a-zA-Zа-яА-ЯёЁ0-9\\s]", "")
                .replaceAll("\\s+", "_")
                + ".pdf";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename(filename)
                .build());

        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }
}
