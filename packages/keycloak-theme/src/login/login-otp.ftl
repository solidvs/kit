<#-- Second factor (ADR-0018): the code of the authenticator app. "Confiar neste dispositivo" comes
     ticked; when it stays ticked, the remember-device step of the flow (solidvs-remember-device)
     remembers this browser and the next sign-ins here ask only for the password. Unticked, or on a
     page without the box, nothing is remembered. -->
<#import "template.ftl" as layout>
<#assign invalid = messagesPerField.existsError('totp')>
<@layout.registrationLayout displayMessage=!invalid; section>
    <#if section = "header">
        ${msg("platformOtpTitle")}
    <#elseif section = "subtitle">
        <p class="ui-login__subtitle">${msg("platformOtpHint")}</p>
    <#elseif section = "form">
        <form id="kc-otp-login-form" class="ui-login__form" action="${url.loginAction}" method="post" onsubmit="login.disabled = true; return true;" novalidate>
            <#if otpLogin.userOtpCredentials?size gt 1>
                <fieldset class="ui-login__field ui-login__choices-group">
                    <legend class="ui-login__label">${msg("platformOtpApp")}</legend>
                    <#list otpLogin.userOtpCredentials as credential>
                        <label class="ui-login__remember">
                            <input type="radio" name="selectedCredentialId" value="${credential.id}"<#if credential.id == otpLogin.selectedCredentialId> checked</#if>>
                            ${credential.userLabel!msg("platformOtpApp")}
                        </label>
                    </#list>
                </fieldset>
            <#else>
                <input type="hidden" name="selectedCredentialId" value="${otpLogin.selectedCredentialId!''}">
            </#if>

            <div class="ui-login__field">
                <label class="ui-login__label" for="otp">${msg("platformOtpLabel")}</label>
                <div class="ui-textfield<#if invalid> ui-textfield--invalid</#if>">
                    <input class="ui-textfield__input" id="otp" name="otp" type="text" inputmode="numeric" autocomplete="one-time-code"
                           maxlength="8" autofocus aria-invalid="${invalid?c}"<#if invalid> aria-describedby="input-error"</#if>>
                </div>
                <#if invalid>
                    <p id="input-error" class="ui-login__error" aria-live="polite">${kcSanitize(messagesPerField.get('totp'))?no_esc}</p>
                </#if>
            </div>

            <div class="ui-login__field">
                <label class="ui-login__remember">
                    <input id="trustDevice" name="trustDevice" type="checkbox" value="on" checked aria-describedby="trust-device-hint"> ${msg("platformTrustDevice")}
                </label>
                <p id="trust-device-hint" class="ui-login__hint">${msg("platformTrustDeviceHint")}</p>
            </div>

            <button class="ui-button ui-button--primary ui-button--fit ui-login__submit" name="login" id="kc-login" type="submit">${msg("platformOtpSubmit")}</button>
            <p class="ui-login__notice" role="note">${msg("platformOtpNeverShare")}</p>
        </form>
    </#if>
</@layout.registrationLayout>
