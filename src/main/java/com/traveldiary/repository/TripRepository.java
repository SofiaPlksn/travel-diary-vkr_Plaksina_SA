package com.traveldiary.repository;

import com.traveldiary.entity.Trip;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface TripRepository extends JpaRepository<Trip, Long> {

    Page<Trip> findByUserIdOrderByStartDateDesc(Long userId, Pageable pageable);

    @Query("""
            SELECT t FROM Trip t
            WHERE t.user.id = :userId
            AND (:status IS NULL OR t.status = :status)
            AND (:search IS NULL 
                 OR LOWER(t.title) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%'))
                 OR LOWER(t.country) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%'))
                 OR LOWER(t.city) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')))
            AND (:year IS NULL OR YEAR(t.startDate) = :year)
            """)
    Page<Trip> searchUserTrips(
            @Param("userId") Long userId,
            @Param("search") String search,
            @Param("status") Trip.Status status,
            @Param("year") Integer year,
            Pageable pageable
    );

    @Query("SELECT DISTINCT YEAR(t.startDate) FROM Trip t WHERE t.user.id = :userId AND t.startDate IS NOT NULL ORDER BY YEAR(t.startDate) DESC")
    List<Integer> findDistinctYearsByUserId(@Param("userId") Long userId);

    Optional<Trip> findByShareToken(String shareToken);

    @Query("""
            SELECT t FROM Trip t
            WHERE t.user.id = :userId
            AND (
                (MONTH(t.startDate) = :month AND DAY(t.startDate) = :day)
                OR
                (MONTH(t.endDate) = :month AND DAY(t.endDate) = :day)
            )
            AND YEAR(t.startDate) < :currentYear
            """)
    List<Trip> findMemoriesOnThisDay(
            @Param("userId") Long userId,
            @Param("month") int month,
            @Param("day") int day,
            @Param("currentYear") int currentYear
    );

    @Query("SELECT COUNT(DISTINCT t.country) FROM Trip t WHERE t.user.id = :userId AND t.status = 'COMPLETED'")
    long countDistinctCountriesByUserId(@Param("userId") Long userId);

    @Query("SELECT COUNT(DISTINCT t.city) FROM Trip t WHERE t.user.id = :userId AND t.status = 'COMPLETED'")
    long countDistinctCitiesByUserId(@Param("userId") Long userId);

    List<Trip> findByUserIdAndStartDateBetween(Long userId, LocalDate from, LocalDate to);
}
