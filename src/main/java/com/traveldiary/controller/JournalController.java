package com.traveldiary.controller;

import com.traveldiary.dto.JournalDto;
import com.traveldiary.entity.User;
import com.traveldiary.service.JournalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/trips/{tripId}/journal")
@RequiredArgsConstructor
public class JournalController {

    private final JournalService journalService;

    @GetMapping
    public ResponseEntity<List<JournalDto.Response>> getJournal(
            @PathVariable Long tripId,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(journalService.getTripJournal(tripId, user.getId()));
    }

    @PostMapping
    public ResponseEntity<JournalDto.Response> createEntry(
            @PathVariable Long tripId,
            @Valid @RequestBody JournalDto.CreateRequest request,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(journalService.createEntry(tripId, request, user.getId()));
    }

    @PutMapping("/{entryId}")
    public ResponseEntity<JournalDto.Response> updateEntry(
            @PathVariable Long tripId,
            @PathVariable Long entryId,
            @RequestBody JournalDto.UpdateRequest request,
            @AuthenticationPrincipal User user
    ) {
        return ResponseEntity.ok(journalService.updateEntry(entryId, request, user.getId()));
    }

    @DeleteMapping("/{entryId}")
    public ResponseEntity<Void> deleteEntry(
            @PathVariable Long tripId,
            @PathVariable Long entryId,
            @AuthenticationPrincipal User user
    ) {
        journalService.deleteEntry(entryId, user.getId());
        return ResponseEntity.noContent().build();
    }
}
