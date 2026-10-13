import type { Environment } from "@modules/domain/connections"
import type { MoneyProvider } from "./channel-connections.contracts"

/** What differs between the bank and payment feeds. */
export interface MoneyRules {
    /** The environments the provider has. */
    readonly environments: ReadonlyArray<Environment>
    /** Whether the owner names a bank account. */
    readonly needsBank: boolean
    /** The provider values pasted by the owner and stored sealed. */
    readonly credentials: ReadonlyArray<string>
    /** Whether the provider is asked to confirm the webhook address after the keys are saved. */
    readonly confirmsWebhook: boolean
}

const RULES: Readonly<Record<MoneyProvider, MoneyRules>> = {
    sepay: { environments: ["test", "live"], needsBank: true, credentials: [], confirmsWebhook: false },
    payos: {
        environments: ["live"],
        needsBank: false,
        credentials: ["clientId", "apiKey", "checksumKey"],
        confirmsWebhook: true,
    },
    casso: { environments: ["live"], needsBank: true, credentials: ["secureKey"], confirmsWebhook: false },
}

/** True when the text names a bank or payment feed a wizard can create. */
export const isMoneyProvider = (value: string): value is MoneyProvider =>
    value === "sepay" || value === "payos" || value === "casso"

/** The rules of one feed. */
export const moneyRules = (provider: MoneyProvider): MoneyRules => RULES[provider]

/** The environment asked for when the provider has it, else the fallback. */
export const chooseEnvironment = (rules: MoneyRules, asked: string, fallback: Environment): Environment =>
    rules.environments.find((environment) => environment === asked) ?? fallback

const MASK = "••••"

/** The account number as it is shown and stored in the public facts: its last four digits behind a mask. */
export const maskAccount = (account: string): string => `${MASK} ${account.slice(-4)}`

const ACCOUNT = /^\d{6,20}$/u
const SEPAY_KEY = /^[A-Za-z0-9_-]{16,128}$/u
const TELEGRAM_TOKEN = /^\d{5,}:[A-Za-z0-9_-]{30,}$/u
const ZALO_APP_ID = /^\d{6,30}$/u

/** Removes every whitespace from an account number. */
export const squeeze = (value: string): string => value.replace(/\s+/gu, "")

/** True for a 6 to 20 digit account number. */
export const isAccountNumber = (value: string): boolean => ACCOUNT.test(value)

/** True for a SePay API key (16 to 128 letters, digits, dashes or underscores). */
export const isSepayKey = (value: string): boolean => SEPAY_KEY.test(value)

/** True for a Telegram bot token. */
export const isTelegramToken = (value: string): boolean => TELEGRAM_TOKEN.test(value)

/** True for a Zalo app id (digits only). */
export const isZaloAppId = (value: string): boolean => ZALO_APP_ID.test(value)

/** The trimmed text cut to `max` characters. */
export const clean = (value: string, max: number): string => value.trim().slice(0, max)
