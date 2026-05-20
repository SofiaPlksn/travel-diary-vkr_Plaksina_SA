package com.traveldiary.repository;

import com.traveldiary.entity.TripFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TripFileRepository extends JpaRepository<TripFile, Long> {
    List<TripFile> findByTripIdOrderByCreatedAtAsc(Long tripId);
}
