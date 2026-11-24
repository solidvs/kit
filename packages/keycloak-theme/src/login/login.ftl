<#-- Sign-in. An account remembered on this device (only its user name, kept by account-chooser.js in
     the browser's storage for the provider's address) is offered first: Continuar asks only for its
     password, Usar outra conta opens the empty form, Remover conta forgets it. Without script, or with
     nothing remembered, the plain form is shown. No password and no session is remembered. -->
<#import "template.ftl" as layout>
<#assign invalid = messagesPerField.existsError('username','password')>
<@layout.registrationLayout displayMessage=!invalid displayInfo=false; section>
    <#if section = "header">
        <span data-title-choose hidden>${msg("platformChooseAccount")}</span><span data-title-sign-in>${msg("platformSignIn")}</span>
    <#elseif section = "subtitle">
        <p class="ui-login__subtitle" data-title-sign-in>${msg("platformSignInHint")}</p>
    <#elseif section = "form">
        <#if realm.password>
            <form id="kc-form-login" class="ui-login__form" action="${url.loginAction}" method="post" onsubmit="login.disabled = true; return true;" novalidate
                  data-account-chooser<#if invalid> data-invalid</#if>>
                    <div class="ui-login__account" data-account hidden>
                        <span class="ui-login__avatar" aria-hidden="true" data-account-initial></span>
                        <span class="ui-login__account-text">
                            <span class="ui-login__account-name" data-account-name></span>
                            <span class="ui-login__account-hint">${msg("platformNetworkAccount")}</span>
                        </span>
                    </div>
                    <div class="ui-login__choices" data-choices hidden>
                        <button class="ui-button ui-button--primary ui-button--fit" type="button" data-choice="continue">${msg("platformContinue")}</button>
                        <button class="ui-button ui-button--default ui-button--fit" type="button" data-choice="other">${msg("platformUseAnotherAccount")}</button>
                        <button class="ui-button ui-button--default ui-button--fit" type="button" data-choice="remove">${msg("platformRemoveAccount")}</button>
                    </div>

                <div class="ui-login__fields" data-fields>
                    <div class="ui-login__field" data-username-field>
                        <label class="ui-login__label" for="username"><#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if></label>
                        <div class="ui-textfield<#if invalid> ui-textfield--invalid</#if>">
                            <input class="ui-textfield__input" id="username" name="username" type="text" value="${(login.username!'')}"
                                   autocomplete="username" autocapitalize="none" spellcheck="false" autofocus
                                   aria-invalid="${invalid?c}"<#if invalid> aria-describedby="input-error"</#if>>
                        </div>
                    </div>

                    <div class="ui-login__field">
                        <label class="ui-login__label" for="password">${msg("password")}</label>
                        <div class="ui-textfield<#if invalid> ui-textfield--invalid</#if>">
                            <input class="ui-textfield__input" id="password" name="password" type="password" autocomplete="current-password"
                                   aria-invalid="${invalid?c}"<#if invalid> aria-describedby="input-error"</#if>>
                            <button class="ui-button ui-button--subtle ui-button--compact ui-icon-button ui-login__reveal" type="button"
                                    data-password-toggle aria-controls="password" aria-pressed="false"
                                    aria-label="${msg("platformShowPassword")}" data-label-show="${msg("platformShowPassword")}" data-label-hide="${msg("platformHidePassword")}">
                                <svg class="ui-login__reveal-show" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                                    <path d="M1.75 8C3.1 5.3 5.35 3.75 8 3.75S12.9 5.3 14.25 8C12.9 10.7 10.65 12.25 8 12.25S3.1 10.7 1.75 8Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                                    <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
                                </svg>
                                <svg class="ui-login__reveal-hide" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                                    <path d="M4.1 4.9C3.15 5.6 2.35 6.6 1.75 8C3.1 10.7 5.35 12.25 8 12.25c1.15 0 2.2-.3 3.15-.85M6.6 3.95c.45-.13.92-.2 1.4-.2 2.65 0 4.9 1.55 6.25 4.25-.4.8-.9 1.5-1.45 2.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M6.6 6.6a2 2 0 0 0 2.8 2.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                    <path d="M2.5 2.5l11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                </svg>
                            </button>
                        </div>
                        <#if invalid>
                            <p id="input-error" class="ui-login__error" aria-live="polite">${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}</p>
                        </#if>
                    </div>

                    <#-- Not sent to the provider: only account-chooser.js reads it. -->
                    <label class="ui-login__remember" data-remember hidden>
                        <input id="rememberAccount" type="checkbox"> ${msg("platformRememberMe")}
                    </label>

                    <input type="hidden" id="id-hidden-input" name="credentialId"<#if auth.selectedCredential?has_content> value="${auth.selectedCredential}"</#if>>
                    <button class="ui-button ui-button--primary ui-button--fit ui-login__submit" name="login" id="kc-login" type="submit">${msg("platformSignIn")}</button>
                </div>
            </form>
        </#if>
    </#if>
</@layout.registrationLayout>
