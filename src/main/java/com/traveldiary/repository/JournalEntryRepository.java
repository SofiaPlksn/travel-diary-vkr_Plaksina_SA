package com.traveldiary.repository;

import com.traveldiary.entity.JournalEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface JournalEntryRepository extends JpaRepository<JournalEntry, Long> {
    List<JournalEntry> findByTripIdOrderByEntryDateAsc(Long tripId);
}
