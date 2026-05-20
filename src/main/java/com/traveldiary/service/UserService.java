package com.traveldiary.service;

import com.traveldiary.dto.UserDto;
import com.traveldiary.entity.Trip;
import com.traveldiary.entity.User;
import com.traveldiary.exception.EmailAlreadyExistsException;
import com.traveldiary.exception.ResourceNotFoundException;
import com.traveldiary.repository.TripRepository;
import com.traveldiary.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final TripRepository tripRepository;
    private final PasswordEncoder passwordEncoder;
    private final FileStorageService fileStorageService;

    @Transactional
    public UserDto updateProfile(Long userId, UserDto.UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь не найден"));

        if (!user.getEmail().equalsIgnoreCase(request.getEmail()) &&
                userRepository.existsByEmail(request.getEmail().toLowerCase())) {
            throw new EmailAlreadyExistsException("Email " + request.getEmail() + " уже занят");
        }

        user.setName(request.getName());
        user.setEmail(request.getEmail().toLowerCase());

        return UserDto.from(userRepository.save(user));
    }

    @Transactional
    public void updatePassword(Long userId, UserDto.UpdatePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь не найден"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Текущий пароль указан неверно");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    @Transactional
    public UserDto updateAvatar(Long userId, MultipartFile file) throws IOException {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь не найден"));

        String avatarUrl = fileStorageService.saveAvatar(file, userId);
        user.setAvatarUrl(avatarUrl);

        return UserDto.from(userRepository.save(user));
    }

    @Transactional
    public void deleteAccount(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь не найден"));

        List<Trip> userTrips = tripRepository
                .findByUserIdOrderByStartDateDesc(userId, Pageable.unpaged())
                .getContent();

        tripRepository.deleteAll(userTrips);
        userRepository.delete(user);
        fileStorageService.deleteUserFiles(userId);

        log.info("User account deleted: id={}, email={}", userId, user.getEmail());
    }
}
