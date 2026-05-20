package com.traveldiary.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
public class FileStorageService {

    @Value("${file.upload-dir}")
    private String uploadDir;

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp"
    );

    private static final Set<String> ALLOWED_VIDEO_TYPES = Set.of(
            "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/avi"
    );

    private static final Set<String> ALLOWED_DOCUMENT_TYPES = Set.of(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain",
            "text/csv",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/rtf"
    );

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;
    private static final long MAX_VIDEO_SIZE = 500 * 1024 * 1024;
    private static final long MAX_DOCUMENT_SIZE = 50 * 1024 * 1024;
    private static final int THUMBNAIL_SIZE = 300;

    public StorageResult saveImage(MultipartFile file, Long userId, Long tripId) throws IOException {
        validateImageFile(file);

        String uuid = UUID.randomUUID().toString();
        String extension = getExtension(file.getOriginalFilename());
        String originalFileName = uuid + "_original." + extension;
        String thumbnailFileName = uuid + "_thumb." + extension;

        Path mediaDir = Paths.get(uploadDir, "media", String.valueOf(userId), String.valueOf(tripId));
        Files.createDirectories(mediaDir);

        Path originalPath = mediaDir.resolve(originalFileName);
        Files.copy(file.getInputStream(), originalPath, StandardCopyOption.REPLACE_EXISTING);

        Path thumbnailPath = mediaDir.resolve(thumbnailFileName);
        createThumbnail(originalPath, thumbnailPath, extension, THUMBNAIL_SIZE);

        log.info("Image saved: original={}, thumbnail={}", originalPath, thumbnailPath);

        return new StorageResult(
                originalPath.toString(), thumbnailPath.toString(),
                buildFileUrl(userId, tripId, originalFileName),
                buildFileUrl(userId, tripId, thumbnailFileName),
                file.getSize(), file.getContentType()
        );
    }

    public StorageResult saveVideo(MultipartFile file, Long userId, Long tripId) throws IOException {
        validateVideoFile(file);

        String uuid = UUID.randomUUID().toString();
        String extension = getExtension(file.getOriginalFilename());
        String fileName = uuid + "." + extension;

        Path videoDir = Paths.get(uploadDir, "media", String.valueOf(userId), String.valueOf(tripId));
        Files.createDirectories(videoDir);

        Path targetPath = videoDir.resolve(fileName);
        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

        log.info("Video saved: path={}", targetPath);

        String fileUrl = buildFileUrl(userId, tripId, fileName);
        return new StorageResult(targetPath.toString(), null, fileUrl, null, file.getSize(), file.getContentType());
    }

    public StorageResult saveDocument(MultipartFile file, Long userId, Long tripId) throws IOException {
        validateDocumentFile(file);

        String uuid = UUID.randomUUID().toString();
        String extension = getExtension(file.getOriginalFilename());
        String fileName = uuid + "." + extension;

        Path docDir = Paths.get(uploadDir, "documents", String.valueOf(userId), String.valueOf(tripId));
        Files.createDirectories(docDir);

        Path targetPath = docDir.resolve(fileName);
        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

        log.info("Document saved: path={}", targetPath);

        String fileUrl = "/api/files/documents/" + userId + "/" + tripId + "/" + fileName;
        return new StorageResult(targetPath.toString(), null, fileUrl, null, file.getSize(), file.getContentType());
    }

    public String saveAvatar(MultipartFile file, Long userId) throws IOException {
        validateImageFile(file);

        String uuid = UUID.randomUUID().toString();
        String extension = getExtension(file.getOriginalFilename());
        String fileName = uuid + "." + extension;

        Path avatarDir = Paths.get(uploadDir, "avatars", String.valueOf(userId));
        Files.createDirectories(avatarDir);

        try (var files = Files.list(avatarDir)) {
            files.forEach(p -> {
                try { Files.delete(p); }
                catch (IOException e) { log.warn("Failed to delete old avatar {}: {}", p, e.getMessage()); }
            });
        }

        Path targetPath = avatarDir.resolve(fileName);

        BufferedImage original = ImageIO.read(file.getInputStream());
        if (original == null) throw new IllegalArgumentException("Не удалось прочитать изображение");

        int size = Math.min(original.getWidth(), original.getHeight());
        int x = (original.getWidth() - size) / 2;
        int y = (original.getHeight() - size) / 2;
        BufferedImage cropped = original.getSubimage(x, y, size, size);

        int avatarSize = 256;
        Image scaledImage = cropped.getScaledInstance(avatarSize, avatarSize, Image.SCALE_SMOOTH);
        BufferedImage avatar = new BufferedImage(avatarSize, avatarSize, BufferedImage.TYPE_INT_RGB);
        Graphics2D g2d = avatar.createGraphics();
        g2d.drawImage(scaledImage, 0, 0, null);
        g2d.dispose();

        String format = "png".equalsIgnoreCase(extension) ? "png" : "jpeg";
        ImageIO.write(avatar, format, targetPath.toFile());

        log.info("Avatar saved for user {}: {}", userId, targetPath);
        return buildAvatarUrl(userId, fileName);
    }

    public void deleteFile(String filePath) {
        try {
            Path path = Paths.get(filePath);
            Files.deleteIfExists(path);
            log.debug("File deleted: {}", filePath);
        } catch (IOException e) {
            log.warn("Failed to delete file {}: {}", filePath, e.getMessage());
        }
    }

    public void deleteUserFiles(Long userId) {
        if (userId == null) return;

        for (String directory : Set.of("media", "documents", "avatars")) {
            deleteUserDirectory(directory, userId);
        }
    }

    private void deleteUserDirectory(String directory, Long userId) {
        Path uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path target = uploadRoot.resolve(directory).resolve(String.valueOf(userId)).normalize();

        if (!target.startsWith(uploadRoot) || target.equals(uploadRoot)) {
            log.warn("Refusing to delete suspicious user upload path: {}", target);
            return;
        }

        if (!Files.exists(target)) return;

        try (var paths = Files.walk(target)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException e) {
                    log.warn("Failed to delete user file {}: {}", path, e.getMessage());
                }
            });
            log.info("Deleted user upload directory: {}", target);
        } catch (IOException e) {
            log.warn("Failed to delete user upload directory {}: {}", target, e.getMessage());
        }
    }

    private void createThumbnail(Path source, Path target, String extension, int size) {
        try {
            BufferedImage original = ImageIO.read(source.toFile());
            if (original == null) {
                log.warn("Could not read image for thumbnail: {}", source);
                return;
            }

            int origWidth = original.getWidth();
            int origHeight = original.getHeight();

            int thumbWidth, thumbHeight;
            if (origWidth > origHeight) {
                thumbWidth = size;
                thumbHeight = (int) ((double) origHeight / origWidth * size);
            } else {
                thumbHeight = size;
                thumbWidth = (int) ((double) origWidth / origHeight * size);
            }

            Image scaledImage = original.getScaledInstance(thumbWidth, thumbHeight, Image.SCALE_SMOOTH);
            BufferedImage thumbnail = new BufferedImage(thumbWidth, thumbHeight, BufferedImage.TYPE_INT_RGB);
            Graphics2D g2d = thumbnail.createGraphics();
            g2d.drawImage(scaledImage, 0, 0, null);
            g2d.dispose();

            String format = "png".equalsIgnoreCase(extension) ? "png" : "jpeg";
            ImageIO.write(thumbnail, format, target.toFile());

        } catch (Exception e) {
            log.warn("Failed to create thumbnail for {}: {}", source, e.getMessage());
        }
    }

    private void validateImageFile(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Файл не выбран");
        if (file.getSize() > MAX_FILE_SIZE)
            throw new IllegalArgumentException("Файл слишком большой. Максимум: " + MAX_FILE_SIZE / (1024 * 1024) + " MB");
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_IMAGE_TYPES.contains(contentType.toLowerCase()))
            throw new IllegalArgumentException("Неподдерживаемый формат. Разрешены: JPEG, PNG, WebP");
    }

    private void validateVideoFile(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Файл не выбран");
        if (file.getSize() > MAX_VIDEO_SIZE)
            throw new IllegalArgumentException("Видео слишком большое. Максимум: " + MAX_VIDEO_SIZE / (1024 * 1024) + " MB");
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_VIDEO_TYPES.contains(contentType.toLowerCase()))
            throw new IllegalArgumentException("Неподдерживаемый формат видео. Разрешены: MP4, WebM, MOV");
    }

    private void validateDocumentFile(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Файл не выбран");
        if (file.getSize() > MAX_DOCUMENT_SIZE)
            throw new IllegalArgumentException("Документ слишком большой. Максимум: " + MAX_DOCUMENT_SIZE / (1024 * 1024) + " MB");
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_DOCUMENT_TYPES.contains(contentType.toLowerCase()))
            throw new IllegalArgumentException("Неподдерживаемый формат документа. Разрешены PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, PPT, PPTX");
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "jpg";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }

    private String buildFileUrl(Long userId, Long tripId, String filename) {
        return "/api/files/media/" + userId + "/" + tripId + "/" + filename;
    }

    private String buildAvatarUrl(Long userId, String filename) {
        return "/api/files/avatars/" + userId + "/" + filename;
    }

    public record StorageResult(
            String filePath, String thumbnailPath,
            String fileUrl, String thumbnailUrl,
            Long fileSize, String contentType
    ) {}
}
