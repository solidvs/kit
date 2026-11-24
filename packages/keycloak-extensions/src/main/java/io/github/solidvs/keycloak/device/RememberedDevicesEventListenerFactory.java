package io.github.solidvs.keycloak.device;

import org.keycloak.Config;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventListenerProviderFactory;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;

/** Enabled per realm by adding {@value #ID} to the realm's event listeners. */
public final class RememberedDevicesEventListenerFactory implements EventListenerProviderFactory {

    public static final String ID = "solidvs-remembered-devices";

    @Override
    public String getId() {
        return ID;
    }

    @Override
    public EventListenerProvider create(KeycloakSession session) {
        return new RememberedDevicesEventListener(session);
    }

    @Override
    public void init(Config.Scope config) {
        // No server configuration.
    }

    @Override
    public void postInit(KeycloakSessionFactory factory) {
        // Nothing to wire.
    }

    @Override
    public void close() {
        // Nothing held.
    }
}
