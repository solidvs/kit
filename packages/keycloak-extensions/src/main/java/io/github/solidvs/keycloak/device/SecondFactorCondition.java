package io.github.solidvs.keycloak.device;

import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.authenticators.conditional.ConditionalAuthenticator;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.sessions.AuthenticationSessionModel;

/**
 * True when the person must pass the second factor in this sign-in (ADR-0018): always, never, or
 * only on a device that is not remembered, by the realm's {@link DevicePolicy}. A remembered device
 * is checked, and its secret replaced, once per sign-in; the result is kept in the authentication
 * session because Keycloak may evaluate a condition more than once.
 */
public final class SecondFactorCondition implements ConditionalAuthenticator {

    static final SecondFactorCondition SINGLETON = new SecondFactorCondition();
    private static final String NOTE = "solidvs.secondFactorNeeded.";

    @Override
    public boolean matchCondition(AuthenticationFlowContext context) {
        UserModel user = context.getUser();
        if (user == null) return true;
        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        String note = NOTE + user.getId();
        String decided = authSession.getAuthNote(note);
        if (decided != null) return Boolean.parseBoolean(decided);
        boolean needed = needed(context, user);
        authSession.setAuthNote(note, Boolean.toString(needed));
        return needed;
    }

    private static boolean needed(AuthenticationFlowContext context, UserModel user) {
        DevicePolicy policy = DevicePolicy.of(context.getRealm());
        return switch (policy.mode()) {
            case OFF -> false;
            case EVERY_SIGN_IN -> true;
            case NEW_DEVICE -> RememberedDevices.verifyAndRotate(context.getSession(), context.getRealm(), user, policy,
                    context.getEvent()) != RememberedDevices.Outcome.TRUSTED;
        };
    }

    @Override
    public void action(AuthenticationFlowContext context) {
        // A condition shows no page.
    }

    @Override
    public boolean requiresUser() {
        return true;
    }

    @Override
    public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user) {
        // Nothing to set up.
    }

    @Override
    public void close() {
        // Stateless.
    }
}
