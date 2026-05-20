package com.traveldiary.repository;

import com.traveldiary.entity.Media;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MediaRepository extends JpaRepository<Media, Long> {
    List<Media> findByTripIdOrderBySortOrderAsc(Long tripId);
}
