package io.github.solidvs.keycloak.device;

import java.util.List;

import org.keycloak.Config;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.AuthenticatorFactory;
import org.keycloak.models.AuthenticationExecutionModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.provider.ProviderConfigProperty;

public final class RememberDeviceAuthenticatorFactory implements AuthenticatorFactory {

    public static final String ID = "solidvs-remember-device";

    private static final AuthenticationExecutionModel.Requirement[] REQUIREMENTS = {
            AuthenticationExecutionModel.Requirement.REQUIRED,
            AuthenticationExecutionModel.Requirement.DISABLED,
    };

    @Override
    public String getId() {
        return ID;
    }

    @Override
    public String getDisplayType() {
        return "Remember this device (Solidvs)";
    }

    @Override
    public String getHelpText() {
        return "After the second factor, remembers the device when the person ticked the box on the code page (ADR-0018).";
    }

    @Override
    public String getReferenceCategory() {
        return "remembered-device";
    }

    @Override
    public boolean isConfigurable() {
        return false;
    }

    @Override
    public AuthenticationExecutionModel.Requirement[] getRequirementChoices() {
        return REQUIREMENTS;
    }

    @Override
    public boolean isUserSetupAllowed() {
        return false;
    }

    @Override
    public List<ProviderConfigProperty> getConfigProperties() {
        return List.of();
    }

    @Override
    public Authenticator create(KeycloakSession session) {
        return RememberDeviceAuthenticator.SINGLETON;
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
        // Stateless.
    }
}
