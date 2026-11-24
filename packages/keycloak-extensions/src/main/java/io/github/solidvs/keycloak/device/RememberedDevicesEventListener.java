package io.github.solidvs.keycloak.device;

import org.jboss.logging.Logger;
import org.keycloak.events.Details;
import org.keycloak.events.Event;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventType;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.events.admin.OperationType;
import org.keycloak.events.admin.ResourceType;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;

/**
 * Forgets every remembered device of a person whose password changed, by the person or by an
 * administrator (ADR-0018): a new password must not ride on a device trusted under the old one.
 */
public final class RememberedDevicesEventListener implements EventListenerProvider {

    private static final Logger LOG = Logger.getLogger(RememberedDevicesEventListener.class);

    private final KeycloakSession session;

    RememberedDevicesEventListener(KeycloakSession session) {
        this.session = session;
    }

    @Override
    public void onEvent(Event event) {
        boolean passwordChanged = event.getType() == EventType.UPDATE_CREDENTIAL && event.getDetails() != null
                && "password".equals(event.getDetails().get(Details.CREDENTIAL_TYPE));
        if (passwordChanged) forget(event.getRealmId(), event.getUserId());
    }

    @Override
    public void onEvent(AdminEvent event, boolean includeRepresentation) {
        String path = event.getResourcePath();
        if (event.getResourceType() == ResourceType.USER && event.getOperationType() == OperationType.ACTION
                && path != null && path.startsWith("users/") && path.endsWith("/reset-password")) {
            forget(event.getRealmId(), path.substring("users/".length(), path.length() - "/reset-password".length()));
        }
    }

    private void forget(String realmId, String userId) {
        if (realmId == null || userId == null) return;
        RealmModel realm = session.realms().getRealm(realmId);
        UserModel user = realm == null ? null : session.users().getUserById(realm, userId);
        if (user == null) return;
        int forgotten = RememberedDevices.forgetAll(user);
        if (forgotten > 0) LOG.infof("Password changed for user %s in realm %s: %d remembered devices forgotten", userId, realm.getName(), forgotten);
    }

    @Override
    public void close() {
        // Nothing held.
    }
}
