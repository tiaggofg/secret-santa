package com.secretsanta.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import com.secretsanta.domain.exception.DomainValidationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ValueObjectsTest {

    @Test
    void geoCoordinatesShouldValidateLatitudeAndLongitudeBounds() {
        GeoCoordinates valid = new GeoCoordinates(-23.420999, -51.933056);
        assertThat(valid.latitude()).isEqualTo(-23.420999);
        assertThat(valid.longitude()).isEqualTo(-51.933056);

        GeoCoordinates extremes = new GeoCoordinates(90.0, -180.0);
        assertThat(extremes.latitude()).isEqualTo(90.0);
        assertThat(extremes.longitude()).isEqualTo(-180.0);

        assertThatThrownBy(() -> new GeoCoordinates(-90.001, 0.0))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> new GeoCoordinates(90.001, 0.0))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> new GeoCoordinates(0.0, -180.001))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> new GeoCoordinates(0.0, 180.001))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> new GeoCoordinates(Double.NaN, 0.0))
                .isInstanceOf(DomainValidationException.class);
    }

    @Test
    void geoCoordinatesShouldCalculateHaversineDistanceUnderEqualAndOver50Meters() {
        GeoCoordinates origin = new GeoCoordinates(0.0, 0.0);

        // Identical coordinates -> 0m
        assertThat(origin.distanceInMetersTo(origin)).isCloseTo(0.0, within(0.001));

        // ~30 meters north along prime meridian (1 deg lat ~ 111,194.9266m -> 30m ~ 0.000269796 deg)
        GeoCoordinates under50m = new GeoCoordinates(0.000269796, 0.0);
        double distUnder50 = origin.distanceInMetersTo(under50m);
        assertThat(distUnder50).isCloseTo(30.0, within(0.1));
        assertThat(distUnder50).isLessThan(50.0);

        // ~50.0 meters north along prime meridian (50 / 6371000 radians in degrees)
        double degFor50m = Math.toDegrees(50.0 / GeoCoordinates.EARTH_RADIUS_METERS);
        GeoCoordinates exact50m = new GeoCoordinates(degFor50m, 0.0);
        double distExact50 = origin.distanceInMetersTo(exact50m);
        assertThat(distExact50).isCloseTo(50.0, within(0.0001));

        // ~120 meters north along prime meridian (> 50m)
        GeoCoordinates over50m = new GeoCoordinates(0.00108, 0.0);
        double distOver50 = origin.distanceInMetersTo(over50m);
        assertThat(distOver50).isGreaterThan(50.0);
    }

    @Test
    void participantNameShouldTrimValidateLengthAndExposeNormalizedKey() {
        ParticipantName name = new ParticipantName("  Tiago Godoy  ");
        assertThat(name.value()).isEqualTo("Tiago Godoy");
        assertThat(name.normalizedKey()).isEqualTo("tiago godoy");

        assertThatThrownBy(() -> new ParticipantName(null))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> new ParticipantName("A"))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> new ParticipantName("   "))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> new ParticipantName("a".repeat(61)))
                .isInstanceOf(DomainValidationException.class);
    }

    @Test
    void usernameShouldNormalizeLowerCaseAndValidatePattern() {
        Username username = new Username("  Tiago.Godoy_01-a  ");
        assertThat(username.value()).isEqualTo("tiago.godoy_01-a");

        assertThatThrownBy(() -> new Username(null))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> new Username("ab"))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> new Username("a".repeat(31)))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> new Username("tiago godoy"))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> new Username("tiago@godoy"))
                .isInstanceOf(DomainValidationException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0000", "1234", "98765", "123456"})
    void pinValidatorShouldAcceptValid4To6NumericDigits(String validPin) {
        PinValidator.validateRawPin(validPin);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "123", "1234567", "12a4", "abcd", "12 34", "-1234"})
    void pinValidatorShouldRejectNonNumericOrOutOfRangePins(String invalidPin) {
        assertThatThrownBy(() -> PinValidator.validateRawPin(invalidPin))
                .isInstanceOf(DomainValidationException.class);
    }

    @Test
    void pinHashAndPasswordResetTokenHashShouldMaskToStringAndRejectBlank() {
        PinHash pinHash = new PinHash("$2a$10$abcdef1234567890");
        assertThat(pinHash.value()).isEqualTo("$2a$10$abcdef1234567890");
        assertThat(pinHash.toString()).doesNotContain("$2a$10$");

        PasswordResetTokenHash tokenHash = new PasswordResetTokenHash("e3b0c44298fc1c149afbf4c8996fb924");
        assertThat(tokenHash.value()).isEqualTo("e3b0c44298fc1c149afbf4c8996fb924");
        assertThat(tokenHash.toString()).doesNotContain("e3b0c44298fc1c149afbf4c8996fb924");

        assertThatThrownBy(() -> new PinHash(" "))
                .isInstanceOf(DomainValidationException.class);
        assertThatThrownBy(() -> new PasswordResetTokenHash(""))
                .isInstanceOf(DomainValidationException.class);
    }

    @Test
    void statusEnumsShouldResolveAllValues() {
        assertThat(GroupStatus.valueOf("OPEN")).isEqualTo(GroupStatus.OPEN);
        assertThat(GroupStatus.valueOf("DRAWN")).isEqualTo(GroupStatus.DRAWN);
        assertThat(RevealStatus.valueOf("WAITING_DRAW")).isEqualTo(RevealStatus.WAITING_DRAW);
        assertThat(RevealStatus.valueOf("PENDING_REVEAL")).isEqualTo(RevealStatus.PENDING_REVEAL);
        assertThat(RevealStatus.valueOf("REVEALED")).isEqualTo(RevealStatus.REVEALED);
    }
}
