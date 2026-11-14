/** The mark of each provider an account can be with, as the path of the logo the app serves; a provider with no logo draws initials. */
const PROVIDER_LOGOS: Readonly<Record<string, string>> = {
    sepay: "/logos/providers/sepay.png",
    payos: "/logos/providers/payos.svg",
    casso: "/logos/providers/casso.svg",
    telegram: "/logos/providers/telegram.svg",
    zalo_oa: "/logos/providers/zalo.svg",
    meta: "/logos/providers/meta.svg",
    google: "/logos/providers/googlesheets.svg",
    google_drive: "/logos/providers/google_drive.svg",
    webhook: "/logos/providers/n8n.svg",
    database: "/logos/connectors/database.svg",
    openapi: "/logos/connectors/openapi.svg",
    csv_import: "/logos/connectors/csv_import.svg",
    imap: "/logos/connectors/imap.svg",
    telegram_user: "/logos/connectors/telegram_user.svg",
    smtp: "/logos/connectors/smtp.svg",
}

/** The logo path of a provider; undefined for one that has none. */
export const logoOf = (provider: string | undefined): string | undefined =>
    provider === undefined ? undefined : PROVIDER_LOGOS[provider]
