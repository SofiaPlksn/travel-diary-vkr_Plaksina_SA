package com.traveldiary.service;

import com.traveldiary.dto.JournalDto;
import com.traveldiary.entity.JournalEntry;
import com.traveldiary.entity.Trip;
import com.traveldiary.exception.ResourceNotFoundException;
import com.traveldiary.repository.JournalEntryRepository;
import com.traveldiary.repository.TripRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class JournalService {

    private final JournalEntryRepository journalRepository;
    private final TripRepository tripRepository;
    private final TripService tripService;

    public List<JournalDto.Response> getTripJournal(Long tripId, Long userId) {
        findTripAndCheckOwner(tripId, userId);
        return journalRepository.findByTripIdOrderByEntryDateAsc(tripId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public JournalDto.Response createEntry(Long tripId, JournalDto.CreateRequest request, Long userId) {
        Trip trip = findTripAndCheckOwner(tripId, userId);

        JournalEntry entry = JournalEntry.builder()
                .title(request.getTitle())
                .content(request.getContent())
                .entryDate(request.getEntryDate())
                .mood(request.getMood())
                .weatherSummary(request.getWeatherSummary())
                .published(request.isPublished())
                .trip(trip)
                .build();

        return toResponse(journalRepository.save(entry));
    }

    @Transactional
    public JournalDto.Response updateEntry(Long entryId, JournalDto.UpdateRequest request, Long userId) {
        JournalEntry entry = findEntryAndCheckOwner(entryId, userId);

        if (request.getTitle() != null) entry.setTitle(request.getTitle());
        if (request.getContent() != null) entry.setContent(request.getContent());
        if (request.getEntryDate() != null) entry.setEntryDate(request.getEntryDate());
        if (request.getMood() != null) entry.setMood(request.getMood());
        if (request.getWeatherSummary() != null) entry.setWeatherSummary(request.getWeatherSummary());
        if (request.getPublished() != null) entry.setPublished(request.getPublished());

        return toResponse(journalRepository.save(entry));
    }

    @Transactional
    public void deleteEntry(Long entryId, Long userId) {
        JournalEntry entry = findEntryAndCheckOwner(entryId, userId);
        journalRepository.delete(entry);
    }

    private Trip findTripAndCheckOwner(Long tripId, Long userId) {
        Trip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Trip", tripId));
        if (!trip.getUser().getId().equals(userId)) {
            throw new ResourceNotFoundException("Trip", tripId);
        }
        return trip;
    }

    private JournalEntry findEntryAndCheckOwner(Long entryId, Long userId) {
        JournalEntry entry = journalRepository.findById(entryId)
                .orElseThrow(() -> new ResourceNotFoundException("JournalEntry", entryId));
        if (!entry.getTrip().getUser().getId().equals(userId)) {
            throw new ResourceNotFoundException("JournalEntry", entryId);
        }
        return entry;
    }

    private JournalDto.Response toResponse(JournalEntry entry) {
        return JournalDto.Response.builder()
                .id(entry.getId())
                .title(entry.getTitle())
                .content(entry.getContent())
                .entryDate(entry.getEntryDate())
                .mood(entry.getMood())
                .weatherSummary(entry.getWeatherSummary())
                .published(entry.isPublished())
                .tripId(entry.getTrip().getId())
                .createdAt(entry.getCreatedAt())
                .updatedAt(entry.getUpdatedAt())
                .build();
    }

    public List<JournalDto.Response> getPublicTripJournal(String shareToken) {
        Trip trip = tripService.getPublicTripEntity(shareToken);
        return journalRepository.findByTripIdOrderByEntryDateAsc(trip.getId())
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }
}
