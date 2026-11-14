package com.secretsanta.domain.model;

import com.secretsanta.domain.exception.DomainValidationException;
import java.util.Objects;

public record GeoCoordinates(double latitude, double longitude) {

    public static final double EARTH_RADIUS_METERS = 6_371_000.0;

    public GeoCoordinates {
        if (Double.isNaN(latitude) || Double.isInfinite(latitude) || latitude < -90.0 || latitude > 90.0) {
            throw new DomainValidationException("Latitude must be between -90.0 and 90.0");
        }
        if (Double.isNaN(longitude) || Double.isInfinite(longitude) || longitude < -180.0 || longitude > 180.0) {
            throw new DomainValidationException("Longitude must be between -180.0 and 180.0");
        }
    }

    public double distanceInMetersTo(GeoCoordinates other) {
        Objects.requireNonNull(other, "Target coordinates must not be null");
        if (Double.compare(this.latitude, other.latitude) == 0
                && Double.compare(this.longitude, other.longitude) == 0) {
            return 0.0;
        }
        double lat1Rad = Math.toRadians(this.latitude);
        double lat2Rad = Math.toRadians(other.latitude);
        double deltaLat = Math.toRadians(other.latitude - this.latitude);
        double deltaLon = Math.toRadians(other.longitude - this.longitude);

        double sinDeltaLat = Math.sin(deltaLat / 2.0);
        double sinDeltaLon = Math.sin(deltaLon / 2.0);
        double a = sinDeltaLat * sinDeltaLat
                + Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinDeltaLon * sinDeltaLon;
        double clampedA = Math.min(1.0, Math.max(0.0, a));
        double c = 2.0 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1.0 - clampedA));
        return EARTH_RADIUS_METERS * c;
    }
}
