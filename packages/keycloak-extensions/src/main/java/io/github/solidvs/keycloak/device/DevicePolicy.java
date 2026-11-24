package io.github.solidvs.keycloak.device;

import org.keycloak.models.RealmModel;

/**
 * The second-factor policy of a realm (ADR-0018), read from realm attributes. The attributes are
 * written from the platform's administered definitions; when one is missing the default applies,
 * and when one is unreadable the strictest value applies (deny on doubt).
 *
 * @param mode       when the second factor is asked for
 * @param maxAgeDays how long a remembered device lasts, counted from when it was remembered
 * @param idleDays   how long a remembered device lasts without being used
 * @param maxDevices how many devices one person may have remembered; the least recently used goes first
 */
public record DevicePolicy(Mode mode, int maxAgeDays, int idleDays, int maxDevices) {

    public static final String MODE = "solidvs.secondFactor.mode";
    public static final String MAX_AGE_DAYS = "solidvs.rememberedDevice.maxAgeDays";
    public static final String IDLE_DAYS = "solidvs.rememberedDevice.idleDays";
    public static final String MAX_DEVICES = "solidvs.rememberedDevice.maxDevices";

    /** When the second factor is asked for. */
    public enum Mode {
        /** On every device not yet remembered; a remembered device needs only the password (default). */
        NEW_DEVICE("new-device"),
        /** On every sign-in, remembered or not. */
        EVERY_SIGN_IN("every-sign-in"),
        /** Never at sign-in. Sensitive actions still ask for it (level 2). */
        OFF("off");

        private final String value;

        Mode(String value) {
            this.value = value;
        }

        public String value() {
            return value;
        }

        static Mode parse(String value) {
            if (value == null || value.isBlank()) return NEW_DEVICE;
            for (Mode mode : values()) if (mode.value.equals(value.trim())) return mode;
            return EVERY_SIGN_IN;
        }
    }

    public static DevicePolicy of(RealmModel realm) {
        int maxAge = bounded(realm.getAttribute(MAX_AGE_DAYS), 90, 1, 365);
        return new DevicePolicy(
                Mode.parse(realm.getAttribute(MODE)),
                maxAge,
                bounded(realm.getAttribute(IDLE_DAYS), Math.min(30, maxAge), 1, maxAge),
                bounded(realm.getAttribute(MAX_DEVICES), 5, 1, 20));
    }

    long maxAgeMillis() {
        return maxAgeDays * 86_400_000L;
    }

    long idleMillis() {
        return idleDays * 86_400_000L;
    }

    /** A missing value takes the default; an unreadable one takes the lower bound (the strictest). */
    private static int bounded(String value, int fallback, int min, int max) {
        if (value == null || value.isBlank()) return Math.max(min, Math.min(max, fallback));
        try {
            return Math.max(min, Math.min(max, Integer.parseInt(value.trim())));
        } catch (NumberFormatException e) {
            return min;
        }
    }
}
