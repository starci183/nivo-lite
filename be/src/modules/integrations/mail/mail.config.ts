import type { MailSecurity } from "@starci/mail"
import type { EnvSource } from "@modules/platform/config"
import { DEFAULT_SUPPRESS, parseSuppressList } from "./mail-suppress.policy"
import type { MailLanguage, MailOptions } from "./mail.options"

const DEFAULT_PORT = 587
const CONFIRM_TTL_SECONDS = 86_400
const RESET_TTL_SECONDS = 3_600
/** The name this server introduces itself with to a mail server unless `MAIL_HELLO_NAME` says otherwise. */
const HELLO_NAME = "nivo.vn"
const SECURITIES: ReadonlyArray<MailSecurity> = ["tls", "starttls", "none"]
const LANGUAGES: ReadonlyArray<MailLanguage> = ["vi", "en"]
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

/** True when the site address is a public https origin; a missing, plain-http or local address means a development site. */
const isPublicSite = (siteUrl: string | undefined): boolean => {
    if (siteUrl === undefined || !URL.canParse(siteUrl)) return false
    const url = new URL(siteUrl)
    return url.protocol === "https:" && !LOCAL_HOSTS.has(url.hostname) && !url.hostname.endsWith(".localhost")
}

/**
 * Reads the mail configuration with no credential or server defaults; the login is optional and its password reads `<KEY>_FILE`
 * first. The platform sender holds back the recipients of `MAIL_SUPPRESS` and, in development, keeps them in the folder `MAIL_OUTBOX_DIR`. A workspace's own SMTP account may use a private target on a development site or by the explicit flag.
 */
export const parseMailConfig = (env: EnvSource): MailOptions => ({
    host: env.string("MAIL_HOST"),
    port: env.int("MAIL_PORT", DEFAULT_PORT),
    security: env.has("MAIL_SECURITY") ? env.enum("MAIL_SECURITY", SECURITIES) : "starttls",
    ...(env.has("MAIL_USER") ? { auth: { user: env.string("MAIL_USER"), pass: env.secret("MAIL_PASSWORD") } } : {}),
    from: { name: env.string("MAIL_FROM_NAME"), address: env.string("MAIL_FROM") },
    helloName: env.optional("MAIL_HELLO_NAME") ?? HELLO_NAME,
    webOrigin: new URL(env.url("AUTH_WEB_ORIGIN")).origin,
    brandName: env.string("MAIL_FROM_NAME"),
    defaultLanguage: env.has("MAIL_DEFAULT_LANGUAGE") ? env.enum("MAIL_DEFAULT_LANGUAGE", LANGUAGES) : "vi",
    confirmTtlSeconds: env.int("MAIL_CONFIRM_TTL_SECONDS", CONFIRM_TTL_SECONDS),
    resetTtlSeconds: env.int("MAIL_RESET_TTL_SECONDS", RESET_TTL_SECONDS),
    allowPrivateHosts: !isPublicSite(env.optional("SITE_URL")) || env.bool("SMTP_ALLOW_PRIVATE_HOSTS", false),
    suppress: parseSuppressList(env.optional("MAIL_SUPPRESS") ?? DEFAULT_SUPPRESS),
    outboxDir: env.optional("MAIL_OUTBOX_DIR") ?? null,
})
