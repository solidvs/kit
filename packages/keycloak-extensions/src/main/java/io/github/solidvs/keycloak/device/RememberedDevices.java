package io.github.solidvs.keycloak.device;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

import jakarta.ws.rs.core.Cookie;
import jakarta.ws.rs.core.NewCookie;

import org.jboss.logging.Logger;
import org.keycloak.common.util.Time;
import org.keycloak.credential.CredentialModel;
import org.keycloak.events.Details;
import org.keycloak.events.EventBuilder;
import org.keycloak.events.EventType;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.util.JsonSerialization;

/**
 * Devices a person chose to trust after passing the second factor (ADR-0018).
 *
 * <p>Each remembered device is a credential of the person, so it is listed and removed like any
 * other credential (account console, administration API). The browser holds a cookie
 * {@code <credential id>.<secret>}; the server keeps only a SHA-256 hash of the secret. Every use
 * replaces the secret (rotation) and keeps the previous hash: presenting the previous secret again
 * means the cookie was copied, and every remembered device of the person is forgotten.
 */
public final class RememberedDevices {

    public static final String CREDENTIAL_TYPE = "solidvs-remembered-device";
    public static final String COOKIE = "SOLIDVS_DEVICE";

    private static final Logger LOG = Logger.getLogger(RememberedDevices.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    /** What a device cookie turned out to be. */
    public enum Outcome { TRUSTED, UNKNOWN, EXPIRED, REUSED }

    private RememberedDevices() {
    }

    /** The person's remembered devices, least recently used first. */
    public static List<CredentialModel> of(UserModel user) {
        return user.credentialManager().getStoredCredentialsByTypeStream(CREDENTIAL_TYPE)
                .sorted(Comparator.comparingLong(RememberedDevices::lastUsed))
                .toList();
    }

    /**
     * Checks the device cookie of the current request against the person's remembered devices.
     * A trusted device gets a new secret; anything else gets its cookie cleared.
     */
    public static Outcome verifyAndRotate(KeycloakSession session, RealmModel realm, UserModel user, DevicePolicy policy, EventBuilder event) {
        Outcome outcome = verify(session, realm, user, policy, event);
        if (outcome != Outcome.TRUSTED && presentedCookie(session) != null) clearCookie(session, realm);
        return outcome;
    }

    private static Outcome verify(KeycloakSession session, RealmModel realm, UserModel user, DevicePolicy policy, EventBuilder event) {
        String value = presentedCookie(session);
        if (value == null) return Outcome.UNKNOWN;
        int dot = value.indexOf('.');
        if (dot <= 0 || dot == value.length() - 1) return Outcome.UNKNOWN;
        CredentialModel device = user.credentialManager().getStoredCredentialById(value.substring(0, dot));
        if (device == null || !CREDENTIAL_TYPE.equals(device.getType())) return Outcome.UNKNOWN;

        Map<String, Object> secret = read(device.getSecretData());
        byte[] presented = hash(value.substring(dot + 1));
        if (matches(presented, secret.get("hash"))) {
            long now = Time.currentTimeMillis();
            long created = device.getCreatedDate() == null ? 0 : device.getCreatedDate();
            if (now - created > policy.maxAgeMillis() || now - lastUsed(device) > policy.idleMillis()) {
                user.credentialManager().removeStoredCredentialById(device.getId());
                emit(event, EventType.REMOVE_CREDENTIAL, device.getId(), "expired");
                return Outcome.EXPIRED;
            }
            String next = newSecret();
            secret.put("previousHash", secret.get("hash"));
            secret.put("hash", hex(hash(next)));
            Map<String, Object> data = read(device.getCredentialData());
            data.put("lastUsed", now);
            device.setSecretData(write(secret));
            device.setCredentialData(write(data));
            user.credentialManager().updateStoredCredential(device);
            setCookie(session, realm, device.getId() + "." + next, policy);
            return Outcome.TRUSTED;
        }
        if (matches(presented, secret.get("previousHash"))) {
            int forgotten = forgetAll(user);
            LOG.warnf("Remembered device cookie reused for user %s in realm %s: %d remembered devices forgotten",
                    user.getId(), realm.getName(), forgotten);
            emit(event, EventType.REMOVE_CREDENTIAL, device.getId(), "reuse_detected");
            return Outcome.REUSED;
        }
        return Outcome.UNKNOWN;
    }

    /** Remembers the current device for the person, after the second factor. */
    public static CredentialModel remember(KeycloakSession session, RealmModel realm, UserModel user, DevicePolicy policy, EventBuilder event) {
        List<CredentialModel> existing = of(user);
        for (int i = 0; i <= existing.size() - policy.maxDevices(); i++) {
            user.credentialManager().removeStoredCredentialById(existing.get(i).getId());
            emit(event, EventType.REMOVE_CREDENTIAL, existing.get(i).getId(), "limit_reached");
        }
        long now = Time.currentTimeMillis();
        String secret = newSecret();
        String browser = describe(session.getContext().getHttpRequest().getHttpHeaders().getHeaderString("User-Agent"));

        CredentialModel device = new CredentialModel();
        device.setType(CREDENTIAL_TYPE);
        device.setCreatedDate(now);
        device.setUserLabel(browser + " (" + secret.substring(0, 4) + ")");
        Map<String, Object> secretData = new HashMap<>();
        secretData.put("hash", hex(hash(secret)));
        device.setSecretData(write(secretData));
        Map<String, Object> data = new HashMap<>();
        data.put("lastUsed", now);
        data.put("browser", browser);
        device.setCredentialData(write(data));
        device = user.credentialManager().createStoredCredential(device);

        setCookie(session, realm, device.getId() + "." + secret, policy);
        emit(event, EventType.UPDATE_CREDENTIAL, device.getId(), "device_remembered");
        return device;
    }

    /** Forgets every remembered device of the person. Returns how many there were. */
    public static int forgetAll(UserModel user) {
        List<CredentialModel> devices = of(user);
        devices.forEach(device -> user.credentialManager().removeStoredCredentialById(device.getId()));
        return devices.size();
    }

    /** A short, human description of the browser, for the list of devices. */
    static String describe(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) return "Navegador desconhecido";
        String browser = userAgent.contains("Edg/") ? "Edge"
                : userAgent.contains("OPR/") ? "Opera"
                : userAgent.contains("Firefox/") ? "Firefox"
                : userAgent.contains("Chrome/") ? "Chrome"
                : userAgent.contains("Safari/") ? "Safari"
                : "Navegador";
        String system = userAgent.contains("Windows") ? "Windows"
                : userAgent.contains("Android") ? "Android"
                : userAgent.contains("iPhone") || userAgent.contains("iPad") ? "iOS"
                : userAgent.contains("Mac OS X") ? "macOS"
                : userAgent.contains("Linux") ? "Linux"
                : "outro sistema";
        return browser + " · " + system;
    }

    private static String presentedCookie(KeycloakSession session) {
        Cookie cookie = session.getContext().getHttpRequest().getHttpHeaders().getCookies().get(COOKIE);
        return cookie == null || cookie.getValue() == null || cookie.getValue().isBlank() ? null : cookie.getValue();
    }

    private static void setCookie(KeycloakSession session, RealmModel realm, String value, DevicePolicy policy) {
        session.getContext().getHttpResponse().setCookieIfAbsent(cookie(session, realm, value, (int) (policy.maxAgeMillis() / 1000)));
    }

    private static void clearCookie(KeycloakSession session, RealmModel realm) {
        session.getContext().getHttpResponse().setCookieIfAbsent(cookie(session, realm, "", 0));
    }

    /** Only sent to this realm's pages, never readable by scripts, never sent from another site. */
    private static NewCookie cookie(KeycloakSession session, RealmModel realm, String value, int maxAge) {
        var base = session.getContext().getUri().getBaseUri();
        String path = base.getRawPath() + (base.getRawPath().endsWith("/") ? "" : "/") + "realms/" + realm.getName() + "/";
        return new NewCookie.Builder(COOKIE)
                .value(value)
                .path(path)
                .maxAge(maxAge)
                .httpOnly(true)
                .secure("https".equalsIgnoreCase(base.getScheme()))
                .sameSite(NewCookie.SameSite.STRICT)
                .build();
    }

    private static void emit(EventBuilder event, EventType type, String credentialId, String reason) {
        if (event == null) return;
        event.clone()
                .event(type)
                .detail(Details.CREDENTIAL_TYPE, CREDENTIAL_TYPE)
                .detail(Details.CREDENTIAL_ID, credentialId)
                .detail(Details.REASON, reason)
                .success();
    }

    private static long lastUsed(CredentialModel device) {
        Object value = read(device.getCredentialData()).get("lastUsed");
        if (value instanceof Number number) return number.longValue();
        return device.getCreatedDate() == null ? 0 : device.getCreatedDate();
    }

    private static boolean matches(byte[] presented, Object storedHex) {
        if (!(storedHex instanceof String hex) || hex.isEmpty()) return false;
        try {
            return MessageDigest.isEqual(presented, HexFormat.of().parseHex(hex));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static String newSecret() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static byte[] hash(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String hex(byte[] bytes) {
        return HexFormat.of().formatHex(bytes);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> read(String json) {
        if (json == null || json.isBlank()) return new HashMap<>();
        try {
            return new HashMap<>(JsonSerialization.readValue(json, Map.class));
        } catch (IOException e) {
            return new HashMap<>();
        }
    }

    private static String write(Map<String, Object> value) {
        try {
            return JsonSerialization.writeValueAsString(value);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
