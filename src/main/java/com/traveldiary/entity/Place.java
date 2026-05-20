package com.traveldiary.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "places")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Place {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String address;

    private Double latitude;
    private Double longitude;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Category category = Category.OTHER;

    private Integer rating;

    private LocalDateTime visitedAt;

    @Builder.Default
    private boolean wishlist = false;

    private String mapboxPlaceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false)
    private Trip trip;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum Category {
        HOTEL,
        RESTAURANT,
        ATTRACTION,
        MUSEUM,
        NATURE,
        TRANSPORT,
        SHOPPING,
        ENTERTAINMENT,
        OTHER
    }
}
