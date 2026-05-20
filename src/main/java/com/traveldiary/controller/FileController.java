package com.traveldiary.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.MalformedURLException;
import java.nio.file.Path;
import java.nio.file.Paths;

@Slf4j
@RestController
@RequestMapping("/api/files")
public class FileController {

    @Value("${file.upload-dir}")
    private String uploadDir;

    @GetMapping("/media/{userId}/{tripId}/{filename}")
    public ResponseEntity<Resource> serveMedia(
            @PathVariable Long userId,
            @PathVariable Long tripId,
            @PathVariable String filename
    ) {
        return serveFile("media/" + userId + "/" + tripId, filename);
    }

    @GetMapping("/avatars/{userId}/{filename}")
    public ResponseEntity<Resource> serveAvatar(
            @PathVariable Long userId,
            @PathVariable String filename
    ) {
        return serveFile("avatars/" + userId, filename);
    }

    @GetMapping("/documents/{userId}/{tripId}/{filename}")
    public ResponseEntity<Resource> serveDocument(
            @PathVariable Long userId,
            @PathVariable Long tripId,
            @PathVariable String filename
    ) {
        return serveFile("documents/" + userId + "/" + tripId, filename);
    }

    private ResponseEntity<Resource> serveFile(String subPath, String filename) {
        try {
            Path filePath = Paths.get(uploadDir, subPath, filename)
                    .toAbsolutePath().normalize();

            Path uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
            if (!filePath.startsWith(uploadRoot)) {
                log.warn("Path traversal attempt detected: {}", filename);
                return ResponseEntity.badRequest().build();
            }

            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                return ResponseEntity.notFound().build();
            }

            String contentType = detectContentType(filename);

            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.CACHE_CONTROL, "max-age=86400");

            if (subPath.startsWith("documents/")) {
                headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"");
            } else {
                headers.add(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"");
            }

            return ResponseEntity.ok()
                    .headers(headers)
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(resource);

        } catch (MalformedURLException e) {
            log.error("Malformed URL for file: {}", filename);
            return ResponseEntity.badRequest().build();
        }
    }

    private String detectContentType(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".mp4")) return "video/mp4";
        if (lower.endsWith(".webm")) return "video/webm";
        if (lower.endsWith(".mov")) return "video/quicktime";
        if (lower.endsWith(".avi")) return "video/x-msvideo";
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".doc")) return "application/msword";
        if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
        if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (lower.endsWith(".txt") || lower.endsWith(".csv")) return "text/plain";
        if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
        if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        if (lower.endsWith(".rtf")) return "application/rtf";
        return "application/octet-stream";
    }
}
