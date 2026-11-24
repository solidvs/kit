<#-- Platform layout for every page of the login flow: one centered card with the system's brand on
     top and the platform footer at the bottom. -->
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<#assign systemName = (client?? && client.name?has_content)?then(advancedMsg(client.name), "")>
<#assign logoUri = (client?? && client.attributes?? && client.attributes.logoUri??)?then(client.attributes.logoUri, "")>
<#assign forgotUrl = msg("platformForgotPasswordUrl")?trim>
<#assign signInPage = pageId == "login" || pageId == "login-password">
<!DOCTYPE html>
<html class="${properties.kcHtmlClass!}" lang="${lang}" data-color-mode="light">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${systemName?has_content?then(systemName + " · ", "")}${msg("platformSignIn")}</title>
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet">
        </#list>
    </#if>
    <#if properties.scripts?has_content>
        <#list properties.scripts?split(' ') as script>
            <script src="${url.resourcesPath}/${script}" defer></script>
        </#list>
    </#if>
</head>
<body class="${properties.kcBodyClass!} ${bodyClass}" data-page-id="login-${pageId}">
<main class="ui-login">
    <section class="ui-login__card" aria-labelledby="ui-login-title">
        <div class="ui-login__brand">
            <#if logoUri?has_content>
                <img class="ui-login__logo" src="${logoUri}" alt="" width="40" height="40">
            <#else>
                <svg class="ui-login__mark" width="40" height="40" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <rect class="ui-login__mark-tile" width="24" height="24" rx="6"/>
                    <path class="ui-login__mark-letter" d="M8 6.5h5a3.75 3.75 0 0 1 0 7.5h-2.5v3.5H8z"/>
                </svg>
            </#if>
            <span class="ui-login__brand-name">${systemName?has_content?then(systemName, msg("platformName"))}</span>
        </div>

        <header class="ui-login__card-header">
            <h1 id="ui-login-title" class="ui-login__title"><#nested "header"></h1>
            <#nested "subtitle">
        </header>

        <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
            <div class="ui-login__alert ui-login__alert--${message.type}" role="${(message.type == 'error')?then('alert', 'status')}">
                ${kcSanitize(message.summary)?no_esc}
            </div>
        </#if>

        <#nested "form">

        <#if displayInfo>
            <div class="ui-login__info"><#nested "info"></div>
        </#if>

        <footer class="ui-login__footer">
            <div class="ui-login__footer-brand">
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <rect class="ui-login__footer-tile" width="24" height="24" rx="6"/>
                    <path class="ui-login__mark-letter" d="M8 6.5h5a3.75 3.75 0 0 1 0 7.5h-2.5v3.5H8z"/>
                </svg>
                <span>${msg("platformName")}</span>
            </div>
            <p class="ui-login__footer-text">${msg("platformOneAccount")}</p>
            <#if signInPage>
                <p class="ui-login__footer-links">
                    <#if forgotUrl?has_content>
                        <a href="${forgotUrl}" rel="noopener">${msg("platformForgotPassword")}</a>
                    <#else>
                        ${msg("platformForgotPasswordFallback")}
                    </#if>
                </p>
            </#if>
        </footer>
    </section>
</main>
</body>
</html>
</#macro>
