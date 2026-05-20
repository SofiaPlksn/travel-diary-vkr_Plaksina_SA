package com.traveldiary.repository;

import com.traveldiary.entity.Place;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PlaceRepository extends JpaRepository<Place, Long> {

    List<Place> findByTripId(Long tripId);

    List<Place> findByTripIdAndCategory(Long tripId, Place.Category category);

    @Query("""
        SELECT p FROM Place p
        WHERE p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
        AND ABS(p.latitude - :lat) < :delta
        AND ABS(p.longitude - :lng) < :delta
        AND p.trip.user.id = :userId
        """)
    List<Place> findNearby(
            @Param("userId") Long userId,
            @Param("lat") Double lat,
            @Param("lng") Double lng,
            @Param("delta") Double delta
    );
}
