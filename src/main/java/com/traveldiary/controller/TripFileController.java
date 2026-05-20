package com.traveldiary.controller;

import com.traveldiary.dto.TripFileDto;
import com.traveldiary.entity.User;
import com.traveldiary.service.TripFileService;
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
@RequestMapping("/api/trips/{tripId}/files")
@RequiredArgsConstructor
public class TripFileController {

    private final TripFileService tripFileService;

    @GetMapping
    public ResponseEntity<List<TripFileDto.Response>> getFiles(
            @PathVariable Long tripId,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(tripFileService.getTripFiles(tripId, user.getId()));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<TripFileDto.Response> uploadFile(
            @PathVariable Long tripId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User user
    ) throws IOException {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(tripFileService.uploadDocument(tripId, file, user.getId()));
    }

    @DeleteMapping("/{fileId}")
    public ResponseEntity<Void> deleteFile(
            @PathVariable Long tripId,
            @PathVariable Long fileId,
            @AuthenticationPrincipal User user
    ) {
        tripFileService.deleteDocument(tripId, fileId, user.getId());
        return ResponseEntity.noContent().build();
    }
}
