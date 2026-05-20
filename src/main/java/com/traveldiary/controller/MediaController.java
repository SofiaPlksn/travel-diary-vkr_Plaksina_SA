package com.traveldiary.controller;

import com.traveldiary.dto.MediaDto;
import com.traveldiary.entity.User;
import com.traveldiary.service.MediaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/trips/{tripId}")
@RequiredArgsConstructor
public class MediaController {

    private final MediaService mediaService;

    @PostMapping(value = "/media/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MediaDto.Response> uploadImage(
            @PathVariable Long tripId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User user
    ) throws IOException {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mediaService.uploadImage(tripId, file, user.getId()));
    }

    @PostMapping(value = "/media/video", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MediaDto.Response> uploadVideo(
            @PathVariable Long tripId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User user
    ) throws IOException {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(mediaService.uploadVideo(tripId, file, user.getId()));
    }

    @GetMapping("/media")
    public ResponseEntity<List<MediaDto.GalleryItem>> getGallery(
            @PathVariable Long tripId,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(mediaService.getTripGallery(tripId, user.getId()));
    }

    @GetMapping("/media/map")
    public ResponseEntity<List<MediaDto.GalleryItem>> getMediaForMap(
            @PathVariable Long tripId,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(mediaService.getMediaWithGps(tripId, user.getId()));
    }

    @PutMapping("/media/{mediaId}")
    public ResponseEntity<MediaDto.Response> updateMedia(
            @PathVariable Long tripId,
            @PathVariable Long mediaId,
            @RequestBody MediaDto.UpdateRequest request,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(mediaService.updateMedia(mediaId, request, user.getId()));
    }

    @DeleteMapping("/media/{mediaId}")
    public ResponseEntity<Void> deleteMedia(
            @PathVariable Long tripId,
            @PathVariable Long mediaId,
            @AuthenticationPrincipal User user
    ) {
        mediaService.deleteMedia(mediaId, user.getId());
        return ResponseEntity.noContent().build();
    }
}
