package com.traveldiary.service;

import com.traveldiary.dto.TripFileDto;
import com.traveldiary.entity.Trip;
import com.traveldiary.entity.TripFile;
import com.traveldiary.exception.ResourceNotFoundException;
import com.traveldiary.repository.TripFileRepository;
import com.traveldiary.repository.TripRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TripFileService {

    private final TripFileRepository tripFileRepository;
    private final TripRepository tripRepository;
    private final FileStorageService fileStorageService;

    @Transactional
    public TripFileDto.Response uploadDocument(Long tripId, MultipartFile file, Long userId) throws IOException {
        Trip trip = findTripAndCheckOwner(tripId, userId);

        FileStorageService.StorageResult storage = fileStorageService.saveDocument(file, userId, tripId);

        TripFile tripFile = TripFile.builder()
                .originalFileName(file.getOriginalFilename())
                .filePath(storage.filePath())
                .fileSize(storage.fileSize())
                .contentType(storage.contentType())
                .trip(trip)
                .build();

        tripFile = tripFileRepository.save(tripFile);
        log.info("Document uploaded: id={}, trip={}", tripFile.getId(), tripId);

        return toDto(tripFile, storage.fileUrl());
    }

    public List<TripFileDto.Response> getTripFiles(Long tripId, Long userId) {
        findTripAndCheckOwner(tripId, userId);
        return tripFileRepository.findByTripIdOrderByCreatedAtAsc(tripId)
                .stream()
                .map(file -> toDto(file, pathToUrl(file.getFilePath())))
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteDocument(Long tripId, Long fileId, Long userId) {
        findTripAndCheckOwner(tripId, userId);

        TripFile file = tripFileRepository.findById(fileId)
                .orElseThrow(() -> new ResourceNotFoundException("TripFile", fileId));

        if (!file.getTrip().getId().equals(tripId)) {
            throw new IllegalArgumentException("Файл не принадлежит данной поездке");
        }

        fileStorageService.deleteFile(file.getFilePath());
        tripFileRepository.delete(file);
        log.info("Document deleted: id={}, trip={}", fileId, tripId);
    }

    private Trip findTripAndCheckOwner(Long tripId, Long userId) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Trip", tripId));
        if (!trip.getUser().getId().equals(userId))
            throw new ResourceNotFoundException("Trip", tripId);
        return trip;
    }

    private TripFileDto.Response toDto(TripFile file, String fileUrl) {
        return TripFileDto.Response.builder()
                .id(file.getId())
                .originalFileName(file.getOriginalFileName())
                .fileUrl(fileUrl)
                .fileSize(file.getFileSize())
                .contentType(file.getContentType())
                .createdAt(file.getCreatedAt())
                .build();
    }

    private String pathToUrl(String filePath) {
        if (filePath == null) return null;
        String normalized = filePath.replace("\\", "/");
        int idx = normalized.indexOf("documents/");
        if (idx >= 0) return "/api/files/" + normalized.substring(idx);
        return filePath;
    }
}
