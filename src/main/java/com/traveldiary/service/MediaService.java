package com.traveldiary.service;

import com.traveldiary.dto.MediaDto;
import com.traveldiary.entity.Media;
import com.traveldiary.entity.Place;
import com.traveldiary.entity.Trip;
import com.traveldiary.exception.ResourceNotFoundException;
import com.traveldiary.repository.MediaRepository;
import com.traveldiary.repository.PlaceRepository;
import com.traveldiary.repository.TripRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MediaService {

    private final MediaRepository mediaRepository;
    private final TripRepository tripRepository;
    private final PlaceRepository placeRepository;
    private final FileStorageService fileStorageService;
    private final ExifParserService exifParserService;
    private final TripService tripService;

    @Transactional
    public MediaDto.Response uploadImage(Long tripId, MultipartFile file, Long userId) throws IOException {
        Trip trip = findTripAndCheckOwner(tripId, userId);

        byte[] fileBytes = file.getBytes();

        FileStorageService.StorageResult storage = fileStorageService.saveImage(file, userId, tripId);

        ExifParserService.ExifResult exif = exifParserService.parseExif(
                new ByteArrayInputStream(fileBytes), file.getOriginalFilename());

        Media media = Media.builder()
                .originalFileName(file.getOriginalFilename())
                .filePath(storage.filePath())
                .thumbnailPath(storage.thumbnailPath())
                .fileSize(storage.fileSize())
                .contentType(storage.contentType())
                .exifDate(exif.shootingDate)
                .exifLatitude(exif.latitude)
                .exifLongitude(exif.longitude)
                .cameraModel(exif.cameraModel)
                .sortOrder(getNextSortOrder(tripId))
                .trip(trip)
                .build();

        media = mediaRepository.save(media);

        log.info("Media (Image) uploaded: id={}, trip={}, hasExifDate={}, hasGps={}",
                media.getId(), tripId, exif.hasDate(), exif.hasGps());

        return toResponse(media, storage.fileUrl(), storage.thumbnailUrl());
    }

    @Transactional
    public MediaDto.Response uploadVideo(Long tripId, MultipartFile file, Long userId) throws IOException {
        Trip trip = findTripAndCheckOwner(tripId, userId);

        FileStorageService.StorageResult storage = fileStorageService.saveVideo(file, userId, tripId);

        Media media = Media.builder()
                .originalFileName(file.getOriginalFilename())
                .filePath(storage.filePath())
                .thumbnailPath(null)
                .fileSize(storage.fileSize())
                .contentType(storage.contentType())
                .sortOrder(getNextSortOrder(tripId))
                .trip(trip)
                .build();

        media = mediaRepository.save(media);
        log.info("Media (Video) uploaded: id={}, trip={}", media.getId(), tripId);
        return toResponse(media, storage.fileUrl(), null);
    }

    public List<MediaDto.GalleryItem> getTripGallery(Long tripId, Long userId) {
        findTripAndCheckOwner(tripId, userId);
        return mediaRepository.findByTripIdOrderBySortOrderAsc(tripId)
                .stream().map(this::toGalleryItem).collect(Collectors.toList());
    }

    @Transactional
    public MediaDto.Response updateMedia(Long mediaId, MediaDto.UpdateRequest request, Long userId) {
        Media media = findMediaAndCheckOwner(mediaId, userId);

        if (request.getCaption() != null) media.setCaption(request.getCaption());
        if (request.getSortOrder() != null) media.setSortOrder(request.getSortOrder());

        if (request.getLatitude() != null && request.getLongitude() != null) {
            media.setExifLatitude(request.getLatitude());
            media.setExifLongitude(request.getLongitude());
        }

        if (request.getPlaceId() != null) {
            Place place = placeRepository.findById(request.getPlaceId())
                    .orElseThrow(() -> new ResourceNotFoundException("Place", request.getPlaceId()));
            media.setPlace(place);
        }

        media = mediaRepository.save(media);
        return toResponse(media, pathToUrl(media.getFilePath()), pathToUrl(media.getThumbnailPath()));
    }

    @Transactional
    public void deleteMedia(Long mediaId, Long userId) {
        Media media = findMediaAndCheckOwner(mediaId, userId);
        fileStorageService.deleteFile(media.getFilePath());
        if (media.getThumbnailPath() != null) {
            fileStorageService.deleteFile(media.getThumbnailPath());
        }
        mediaRepository.delete(media);
        log.info("Media deleted: id={}", mediaId);
    }

    public List<MediaDto.GalleryItem> getMediaWithGps(Long tripId, Long userId) {
        findTripAndCheckOwner(tripId, userId);
        return mediaRepository.findByTripIdOrderBySortOrderAsc(tripId)
                .stream()
                .filter(p -> p.getExifLatitude() != null && p.getExifLongitude() != null)
                .map(this::toGalleryItem)
                .collect(Collectors.toList());
    }

    private int getNextSortOrder(Long tripId) {
        List<Media> existing = mediaRepository.findByTripIdOrderBySortOrderAsc(tripId);
        if (existing.isEmpty()) return 0;
        return existing.get(existing.size() - 1).getSortOrder() + 1;
    }

    private Trip findTripAndCheckOwner(Long tripId, Long userId) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Trip", tripId));
        if (!trip.getUser().getId().equals(userId))
            throw new ResourceNotFoundException("Trip", tripId);
        return trip;
    }

    private Media findMediaAndCheckOwner(Long mediaId, Long userId) {
        Media media = mediaRepository.findById(mediaId)
                .orElseThrow(() -> new ResourceNotFoundException("Media", mediaId));
        if (!media.getTrip().getUser().getId().equals(userId))
            throw new ResourceNotFoundException("Media", mediaId);
        return media;
    }

    private String pathToUrl(String filePath) {
        if (filePath == null) return null;
        String normalized = filePath.replace("\\", "/");
        int idx = normalized.indexOf("media/");
        if (idx >= 0) return "/api/files/" + normalized.substring(idx);
        return normalized.replace("./uploads", "/api/files");
    }

    private MediaDto.Response toResponse(Media media, String fileUrl, String thumbUrl) {
        return MediaDto.Response.builder()
                .id(media.getId()).originalFileName(media.getOriginalFileName())
                .fileUrl(fileUrl).thumbnailUrl(thumbUrl)
                .fileSize(media.getFileSize()).contentType(media.getContentType())
                .exifDate(media.getExifDate())
                .exifLatitude(media.getExifLatitude()).exifLongitude(media.getExifLongitude())
                .cameraModel(media.getCameraModel()).caption(media.getCaption())
                .sortOrder(media.getSortOrder()).tripId(media.getTrip().getId())
                .placeId(media.getPlace() != null ? media.getPlace().getId() : null)
                .createdAt(media.getCreatedAt())
                .build();
    }

    private MediaDto.GalleryItem toGalleryItem(Media media) {
        return MediaDto.GalleryItem.builder()
                .id(media.getId())
                .thumbnailUrl(pathToUrl(media.getThumbnailPath()))
                .fileUrl(pathToUrl(media.getFilePath()))
                .contentType(media.getContentType()).caption(media.getCaption())
                .exifDate(media.getExifDate())
                .exifLatitude(media.getExifLatitude()).exifLongitude(media.getExifLongitude())
                .sortOrder(media.getSortOrder())
                .build();
    }

    public List<MediaDto.GalleryItem> getPublicTripGallery(String shareToken) {
        Trip trip = tripService.getPublicTripEntity(shareToken);
        return mediaRepository.findByTripIdOrderBySortOrderAsc(trip.getId())
                .stream().map(this::toGalleryItem).collect(Collectors.toList());
    }
}
