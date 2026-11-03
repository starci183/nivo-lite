/** Log events of the http-security capability: ids and codes only, never a body, a secret, a signature or a token. */
export enum HttpSecurityLogEvent {
    /** A webhook delivery was refused because its proof did not hold; the provider, scope and code ride in the fields. */
    WebhookRefused = "http_security.webhook.refused",
}
