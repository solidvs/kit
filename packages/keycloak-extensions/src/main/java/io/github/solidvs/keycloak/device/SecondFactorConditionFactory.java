package io.github.solidvs.keycloak.device;

import java.util.List;

import org.keycloak.Config;
import org.keycloak.authentication.authenticators.conditional.ConditionalAuthenticator;
import org.keycloak.authentication.authenticators.conditional.ConditionalAuthenticatorFactory;
import org.keycloak.models.AuthenticationExecutionModel;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.provider.ProviderConfigProperty;

public final class SecondFactorConditionFactory implements ConditionalAuthenticatorFactory {

    public static final String ID = "solidvs-second-factor-condition";

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
        return "Condition - second factor needed (Solidvs)";
    }

    @Override
    public String getHelpText() {
        return "True when the second factor is needed: on every sign-in, never, or only on a device that is not remembered, "
                + "by the realm attribute " + DevicePolicy.MODE + " (ADR-0018).";
    }

    @Override
    public String getReferenceCategory() {
        return "condition";
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
    public ConditionalAuthenticator getSingleton() {
        return SecondFactorCondition.SINGLETON;
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
