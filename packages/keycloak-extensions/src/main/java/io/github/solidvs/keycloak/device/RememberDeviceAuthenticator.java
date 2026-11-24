package io.github.solidvs.keycloak.device;

import java.util.Map;
import java.util.Set;

import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.Authenticator;
import org.keycloak.models.AuthenticationExecutionModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.sessions.AuthenticationSessionModel;

/**
 * Remembers the current device after the second factor (ADR-0018), when the person ticked
 * "Confiar neste dispositivo" on the code page ({@code trustDevice=on}). It never shows a page and
 * never fails the sign-in. It remembers nothing when the second factor did not actually run in this
 * sign-in (for example, while the person is still setting up the authenticator app), when the
 * policy is not {@code new-device}, or when the page had no such box (deny on doubt).
 */
public final class RememberDeviceAuthenticator implements Authenticator {

    static final RememberDeviceAuthenticator SINGLETON = new RememberDeviceAuthenticator();
    static final String FORM_FIELD = "trustDevice";

    /** Second factors after which a device may be remembered. */
    private static final Set<String> SECOND_FACTORS = Set.of("auth-otp-form", "webauthn-authenticator");

    @Override
    public void authenticate(AuthenticationFlowContext context) {
        DevicePolicy policy = DevicePolicy.of(context.getRealm());
        if (policy.mode() == DevicePolicy.Mode.NEW_DEVICE && secondFactorPassed(context) && personAsked(context)) {
            RememberedDevices.remember(context.getSession(), context.getRealm(), context.getUser(), policy, context.getEvent());
        }
        context.success();
    }

    private static boolean secondFactorPassed(AuthenticationFlowContext context) {
        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        RealmModel realm = context.getRealm();
        for (Map.Entry<String, AuthenticationSessionModel.ExecutionStatus> entry : authSession.getExecutionStatus().entrySet()) {
            if (entry.getValue() != AuthenticationSessionModel.ExecutionStatus.SUCCESS) continue;
            AuthenticationExecutionModel execution = realm.getAuthenticationExecutionById(entry.getKey());
            if (execution != null && SECOND_FACTORS.contains(execution.getAuthenticator())) return true;
        }
        return false;
    }

    private static boolean personAsked(AuthenticationFlowContext context) {
        var form = context.getHttpRequest().getDecodedFormParameters();
        return form != null && "on".equals(form.getFirst(FORM_FIELD));
    }

    @Override
    public void action(AuthenticationFlowContext context) {
        context.success();
    }

    @Override
    public boolean requiresUser() {
        return true;
    }

    @Override
    public boolean configuredFor(KeycloakSession session, RealmModel realm, UserModel user) {
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
