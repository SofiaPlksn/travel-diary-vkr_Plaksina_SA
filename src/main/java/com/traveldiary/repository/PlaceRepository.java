package com.traveldiary.repository;

import com.traveldiary.entity.Place;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PlaceRepository extends JpaRepository<Place, Long> {
    List<Place> findByTripId(Long tripId);
    List<Place> findByTripIdAndCategory(Long tripId, Place.Category category);
}
