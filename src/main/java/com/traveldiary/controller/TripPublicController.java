package com.traveldiary.controller;

import com.traveldiary.dto.JournalDto;
import com.traveldiary.dto.MediaDto;
import com.traveldiary.dto.PlaceDto;
import com.traveldiary.entity.Trip;
import com.traveldiary.service.JournalService;
import com.traveldiary.service.MediaService;
import com.traveldiary.service.PlaceService;
import com.traveldiary.service.TripPdfService;
import com.traveldiary.service.TripService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/trips/public/{token}")
@RequiredArgsConstructor
public class TripPublicController {

    private final MediaService mediaService;
    private final JournalService journalService;
    private final PlaceService placeService;
    private final TripService tripService;
    private final TripPdfService tripPdfService;

    @GetMapping("/media")
    public ResponseEntity<List<MediaDto.GalleryItem>> getPublicMedia(@PathVariable String token) {
        return ResponseEntity.ok(mediaService.getPublicTripGallery(token));
    }

    @GetMapping("/journal")
    public ResponseEntity<List<JournalDto.Response>> getPublicJournal(@PathVariable String token) {
        return ResponseEntity.ok(journalService.getPublicTripJournal(token));
    }

    @GetMapping("/places")
    public ResponseEntity<List<PlaceDto.Response>> getPublicPlaces(@PathVariable String token) {
        return ResponseEntity.ok(placeService.getPublicTripPlaces(token));
    }

    @Transactional(readOnly = true)
    @GetMapping("/pdf")
    public ResponseEntity<byte[]> downloadPublicPdf(
            @PathVariable String token,
            @RequestParam(defaultValue = "description,places,journal") String sections
    ) {
        Trip trip = tripService.getPublicTripEntity(token);
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
