package com.traveldiary.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

@Slf4j
@Service
public class ExifParserService {

    public ExifResult parseExif(InputStream inputStream, String fileName) {
        ExifResult result = new ExifResult();

        try {
            com.drew.imaging.ImageMetadataReader.readMetadata(inputStream)
                    .getDirectories()
                    .forEach(directory -> {
                        directory.getTags().forEach(tag -> {
                            String tagName = tag.getTagName();
                            String value = tag.getDescription();

                            if (tagName.equals("Date/Time Original") && result.shootingDate == null) {
                                result.shootingDate = parseExifDate(value);
                            }
                            if (tagName.equals("GPS Latitude") && value != null) {
                                result.latitudeDms = value;
                            }
                            if (tagName.equals("GPS Latitude Ref") && value != null) {
                                result.latitudeRef = value;
                            }
                            if (tagName.equals("GPS Longitude") && value != null) {
                                result.longitudeDms = value;
                            }
                            if (tagName.equals("GPS Longitude Ref") && value != null) {
                                result.longitudeRef = value;
                            }
                            if (tagName.equals("Model") && result.cameraModel == null) {
                                result.cameraModel = value;
                            }
                        });
                    });

            if (result.latitudeDms != null && result.longitudeDms != null) {
                result.latitude = dmsToDecimal(result.latitudeDms, result.latitudeRef);
                result.longitude = dmsToDecimal(result.longitudeDms, result.longitudeRef);
            }

            log.debug("EXIF parsed for {}: date={}, lat={}, lon={}, camera={}",
                    fileName, result.shootingDate, result.latitude, result.longitude, result.cameraModel);

        } catch (Exception e) {
            log.debug("No EXIF data or parse error for file {}: {}", fileName, e.getMessage());
        }

        return result;
    }

    private Double dmsToDecimal(String dms, String ref) {
        try {
            dms = dms.replaceAll("[°'\"]", " ").trim();
            String[] parts = dms.trim().split("\\s+");

            double degrees = Double.parseDouble(parts[0]);
            double minutes = parts.length > 1 ? Double.parseDouble(parts[1]) : 0;
            double seconds = parts.length > 2 ? Double.parseDouble(parts[2]) : 0;

            double decimal = degrees + minutes / 60.0 + seconds / 3600.0;

            if ("S".equalsIgnoreCase(ref) || "W".equalsIgnoreCase(ref)) {
                decimal = -decimal;
            }

            return Math.round(decimal * 1_000_000.0) / 1_000_000.0;
        } catch (Exception e) {
            log.warn("Failed to parse DMS coordinates: {} {}", dms, ref);
            return null;
        }
    }

    private LocalDateTime parseExifDate(String exifDate) {
        if (exifDate == null || exifDate.isBlank()) return null;
        try {
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy:MM:dd HH:mm:ss");
            return LocalDateTime.parse(exifDate, formatter);
        } catch (DateTimeParseException e) {
            log.debug("Could not parse EXIF date: {}", exifDate);
            return null;
        }
    }

    public static class ExifResult {
        public LocalDateTime shootingDate;
        public Double latitude;
        public Double longitude;
        public String cameraModel;

        String latitudeDms;
        String latitudeRef;
        String longitudeDms;
        String longitudeRef;

        public boolean hasGps() {
            return latitude != null && longitude != null;
        }

        public boolean hasDate() {
            return shootingDate != null;
        }
    }
}
