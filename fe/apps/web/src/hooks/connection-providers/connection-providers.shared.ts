import type { Environment, Provider, ProviderKind } from "@/modules/types"

/** One connection provider as data: ids, kinds and links. Every word the owner reads is a catalog key (`providerKey`). */
export interface ProviderDef {
    readonly id: Provider
    readonly kind: ProviderKind
    /** The provider's own brand name, as the wizard prints it ("Open SePay", "Follow on payOS"). */
    readonly brand: string
    readonly module: "accounting" | "chatbot" | null
    /** True when the docs could not be fully confirmed: shown as early access. */
    readonly earlyAccess?: boolean
    readonly environments: ReadonlyArray<Environment>
    /** The provider has no test mode and the environment step says so (catalog key `providerKey(id, "noTest")`). */
    readonly hasNoTestNote?: boolean
    readonly needsBank: boolean
    readonly dashboard: Partial<Record<Environment, string>>
    /** Provider values the owner pastes in the guide and the server stores encrypted. */
    readonly credentials: ReadonlyArray<string>
    /** After saving credentials the server asks this provider to confirm the webhook URL itself. */
    readonly confirmsWebhook?: boolean
}

const data = (id: Provider, brand: string, early = false): ProviderDef => ({
    id,
    kind: "data",
    brand,
    module: null,
    environments: ["live"],
    needsBank: false,
    dashboard: {},
    credentials: [],
    ...(early ? { earlyAccess: true } : {}),
})

/** The registry of providers, keyed by id. */
export const PROVIDERS: Readonly<Record<Provider, ProviderDef>> = {
    openapi: data("openapi", "OpenAPI"),
    database: data("database", "Database"),
    csv_import: data("csv_import", "Excel"),
    imap: data("imap", "IMAP"),
    telegram_user: data("telegram_user", "Telegram", true),
    sepay: {
        id: "sepay",
        kind: "money",
        brand: "SePay",
        module: "accounting",
        environments: ["test", "live"],
        needsBank: true,
        dashboard: { test: "https://my.sepay.vn/testmode/webhook", live: "https://my.sepay.vn/webhook" },
        credentials: [],
    },
    payos: {
        id: "payos",
        kind: "money",
        brand: "payOS",
        module: "accounting",
        earlyAccess: true,
        environments: ["live"],
        needsBank: false,
        hasNoTestNote: true,
        dashboard: { live: "https://my.payos.vn" },
        credentials: ["clientId", "apiKey", "checksumKey"],
        confirmsWebhook: true,
    },
    casso: {
        id: "casso",
        kind: "money",
        brand: "Casso",
        module: "accounting",
        environments: ["live"],
        needsBank: true,
        hasNoTestNote: true,
        dashboard: { live: "https://casso.vn" },
        credentials: ["secureKey"],
    },
    telegram: {
        id: "telegram",
        kind: "telegram",
        brand: "Telegram",
        module: "chatbot",
        environments: ["live"],
        needsBank: false,
        dashboard: { live: "https://t.me/BotFather" },
        credentials: ["token"],
    },
    zalo_oa: {
        id: "zalo_oa",
        kind: "zalo",
        brand: "Zalo",
        module: "chatbot",
        earlyAccess: true,
        environments: ["live"],
        needsBank: false,
        dashboard: { live: "https://developers.zalo.me/apps" },
        credentials: [],
    },
    meta: {
        id: "meta",
        kind: "meta",
        brand: "Meta",
        module: "chatbot",
        earlyAccess: true,
        environments: ["live"],
        needsBank: false,
        dashboard: { live: "https://developers.facebook.com/apps" },
        credentials: [],
    },
    webhook: {
        id: "webhook",
        kind: "webhook",
        brand: "n8n",
        module: null,
        environments: ["live"],
        needsBank: false,
        dashboard: { live: "https://n8n.io" },
        credentials: [],
    },
    google: {
        id: "google",
        kind: "google",
        brand: "Google",
        module: null,
        environments: ["live"],
        needsBank: false,
        dashboard: { live: "https://sheets.google.com" },
        credentials: [],
    },
    smtp: {
        id: "smtp",
        kind: "email",
        brand: "SMTP",
        module: null,
        environments: ["live"],
        needsBank: false,
        dashboard: {},
        credentials: [],
    },
}

/** The provider's own mark (public/logos/providers). Outgoing email has none: it is the shop's own mailbox. */
export const PROVIDER_LOGO: Readonly<Partial<Record<Provider, string>>> = {
    sepay: "/logos/providers/sepay.png",
    payos: "/logos/providers/payos.svg",
    casso: "/logos/providers/casso.svg",
    telegram: "/logos/providers/telegram.svg",
    zalo_oa: "/logos/providers/zalo.svg",
    meta: "/logos/providers/meta.svg",
    google: "/logos/providers/googlesheets.svg",
    webhook: "/logos/providers/n8n.svg",
    // The app's own connector artwork (public/logos/connectors): the data sources have no brand of their own.
    database: "/logos/connectors/database.svg",
    openapi: "/logos/connectors/openapi.svg",
    csv_import: "/logos/connectors/csv_import.svg",
    imap: "/logos/connectors/imap.svg",
    telegram_user: "/logos/connectors/telegram_user.svg",
    smtp: "/logos/connectors/smtp.svg",
}

/** Whether a string is one of the registry's providers. */
export const isProvider = (value: string): value is Provider => Object.hasOwn(PROVIDERS, value)

/** The catalog key of one provider text in the `connections` namespace: its title, blurb or no-test note. */
export const providerKey = (id: Provider, part: "title" | "blurb" | "noTest"): string => `provider_${id}_${part}`
