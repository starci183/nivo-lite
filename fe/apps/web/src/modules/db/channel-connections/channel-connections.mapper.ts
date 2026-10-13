import { submitCommand } from "../connections/submit.mapper"
import type { CommandRequest } from "../connections/submit.mapper"
import type { DbOutcome } from "../outcome"
import type { Environment, MoneyProvider } from "@/modules/types"

/** One command of the channel connections for the back end. */
export type ChannelRequest = CommandRequest

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const MONEY_PROVIDERS: ReadonlySet<string> = new Set(["sepay", "payos", "casso"])
const NAME_MAX = 120
const FIELD_MAX = 200
const KEY_FIELDS_MAX = 8
const KEY_FIELD_NAME = /^[A-Za-z]{1,30}$/u

/** Whether the value is a plain object, the shape every command input is read as. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Whether the value is a UUID string, the form of every workspace and connection id. */
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value)

const text = (value: unknown, max: number): string | null =>
    typeof value === "string" && value.length <= max ? value : null

const isMoneyProvider = (value: unknown): value is MoneyProvider =>
    typeof value === "string" && MONEY_PROVIDERS.has(value)

const environmentOf = (value: unknown): Environment | null => (value === "test" || value === "live" ? value : null)

/** The workspace and connection ids of a command on one connection; null when either is not a UUID. */
const targetOf = (input: unknown): { readonly workspaceId: string; readonly connectionId: string } | null =>
    isRecord(input) && isUuid(input.workspaceId) && isUuid(input.connectionId)
        ? { workspaceId: input.workspaceId, connectionId: input.connectionId }
        : null

/** A command on one connection with no other field: `{ workspaceId, connectionId }` becomes the command of that kind. */
const targetRequest =
    (kind: string) =>
    (input: unknown): ChannelRequest | null => {
        const target = targetOf(input)
        return target === null
            ? null
            : { workspaceId: target.workspaceId, kind, input: { connectionId: target.connectionId } }
    }

/** The telegram.connect command for `{ workspaceId, name, token }`. */
const telegramRequestOf = (input: unknown): ChannelRequest | null => {
    if (!isRecord(input) || !isUuid(input.workspaceId)) return null
    const name = text(input.name, NAME_MAX)
    const token = text(input.token, FIELD_MAX)
    return name === null || token === null
        ? null
        : { workspaceId: input.workspaceId, kind: "telegram.connect", input: { name, token } }
}

/** The editable facts of a bank or payment connection, bounded. */
const moneyFieldsOf = (input: Record<string, unknown>) => {
    const environment = environmentOf(input.environment)
    const name = text(input.name, NAME_MAX)
    const bankCode = text(input.bankCode, FIELD_MAX)
    const accountNumber = text(input.accountNumber, FIELD_MAX)
    const holder = text(input.holder, NAME_MAX)
    if (environment === null || name === null || bankCode === null || accountNumber === null || holder === null)
        return null
    return { environment, name, bankCode, accountNumber, holder }
}

/** The money.start command for `{ workspaceId, provider, environment, name, bankCode, accountNumber, holder }`. */
const moneyStartRequestOf = (input: unknown): ChannelRequest | null => {
    if (!isRecord(input) || !isUuid(input.workspaceId) || !isMoneyProvider(input.provider)) return null
    const fields = moneyFieldsOf(input)
    return fields === null
        ? null
        : {
              workspaceId: input.workspaceId,
              kind: "money.start",
              input: { provider: input.provider, ...fields },
          }
}

/** The money.update command for `{ workspaceId, connectionId, environment, name, bankCode, accountNumber, holder, apiKey? }`. */
const moneyUpdateRequestOf = (input: unknown): ChannelRequest | null => {
    const target = targetOf(input)
    if (target === null || !isRecord(input)) return null
    const fields = moneyFieldsOf(input)
    if (fields === null) return null
    const apiKey = input.apiKey === undefined ? undefined : text(input.apiKey, FIELD_MAX)
    if (apiKey === null) return null
    return {
        workspaceId: target.workspaceId,
        kind: "money.update",
        input: { connectionId: target.connectionId, ...(apiKey === undefined ? fields : { ...fields, apiKey }) },
    }
}

/** The money.provider-keys command for `{ workspaceId, connectionId, values }`: a few bounded fields named by letters only. */
const providerKeysRequestOf = (input: unknown): ChannelRequest | null => {
    const target = targetOf(input)
    if (target === null || !isRecord(input) || !isRecord(input.values)) return null
    const entries = Object.entries(input.values)
    if (entries.length > KEY_FIELDS_MAX) return null
    const values: Record<string, string> = {}
    for (const [field, value] of entries) {
        const clean = text(value, FIELD_MAX)
        if (!KEY_FIELD_NAME.test(field) || clean === null) return null
        values[field] = clean
    }
    return {
        workspaceId: target.workspaceId,
        kind: "money.provider-keys",
        input: { connectionId: target.connectionId, values },
    }
}

/** The zalo.start command for `{ workspaceId, name, appId, appSecret }`. */
const zaloStartRequestOf = (input: unknown): ChannelRequest | null => {
    if (!isRecord(input) || !isUuid(input.workspaceId)) return null
    const name = text(input.name, NAME_MAX)
    const appId = text(input.appId, FIELD_MAX)
    const appSecret = text(input.appSecret, FIELD_MAX)
    if (name === null || appId === null || appSecret === null) return null
    return {
        workspaceId: input.workspaceId,
        kind: "zalo.start",
        input: { name, appId, appSecret },
    }
}

/** The zalo.oa-secret command for `{ workspaceId, connectionId, oaSecret }`. */
const zaloOaSecretRequestOf = (input: unknown): ChannelRequest | null => {
    const target = targetOf(input)
    if (target === null || !isRecord(input)) return null
    const oaSecret = text(input.oaSecret, FIELD_MAX)
    return oaSecret === null
        ? null
        : {
              workspaceId: target.workspaceId,
              kind: "zalo.oa-secret",
              input: { connectionId: target.connectionId, oaSecret },
          }
}

/** The parse result a Server Action reads before it uses its input. */
type Parsed = { readonly success: true; readonly data: ChannelRequest } | { readonly success: false }

/** Turns a request builder into the `safeParse` shape a Server Action reads its input through. */
export const schemaOf = (build: (input: unknown) => ChannelRequest | null) => ({
    safeParse: (input: unknown): Parsed => {
        const data = build(input)
        return data === null ? { success: false } : { success: true, data }
    },
})

/** The bounded schemas of the channel commands: each turns an input into the request, or refuses it. */
export const channelSchemas = {
    telegram: schemaOf(telegramRequestOf),
    moneyStart: schemaOf(moneyStartRequestOf),
    moneyUpdate: schemaOf(moneyUpdateRequestOf),
    moneyResume: schemaOf(targetRequest("money.resume")),
    providerKeys: schemaOf(providerKeysRequestOf),
    zaloStart: schemaOf(zaloStartRequestOf),
    zaloResume: schemaOf(targetRequest("zalo.resume")),
    zaloOaSecret: schemaOf(zaloOaSecretRequestOf),
    zaloAuthorize: schemaOf(targetRequest("zalo.authorize")),
} as const

/** A failure that happens before the back end is reached, in the vocabulary of the outcome. */
export const invalid = (code: string): DbOutcome<never> => ({ kind: "invalid", code })

/** A failure leaves the server as the catalog key of its sentence, so no client needs the error table. */
export const sendRequest = async <T>(
    request: ChannelRequest,
    keyOf: (code: string) => string,
): Promise<DbOutcome<T>> => {
    const outcome = await submitCommand<T>(request)
    return outcome.kind === "ok" ? outcome : { ...outcome, code: keyOf(outcome.code) }
}

/** Sends a request whose success has no answer and answers `true`. */
export const sendDone = async (request: ChannelRequest, keyOf: (code: string) => string): Promise<DbOutcome<true>> => {
    const outcome = await sendRequest<unknown>(request, keyOf)
    return outcome.kind === "ok" ? { kind: "ok", value: true as const } : outcome
}

/** The catalog keys (namespace `connections`) a write answers with when the failure happens before the api is reached. */
export const CHANNEL_FAILURE_KEYS = { refused: "errForbidden", invalid: "errGeneric" } as const

const ERROR_KEYS: Readonly<Record<string, string>> = {
    CONNECTIONS_FORBIDDEN: "errForbidden",
    CONNECTIONS_NOT_FOUND: "errNone",
    CONNECTIONS_NAME_INVALID: "errName",
    CHANNEL_CONNECTIONS_TOKEN_FORMAT: "errFormat",
    CHANNEL_CONNECTIONS_TOKEN_REJECTED: "errToken",
    CHANNEL_CONNECTIONS_NETWORK: "errNetwork",
    CHANNEL_CONNECTIONS_BOT_IN_USE: "errInUse",
    CHANNEL_CONNECTIONS_WEBHOOK_REFUSED: "errWebhook",
    CHANNEL_CONNECTIONS_ACCOUNT_INVALID: "errAccount",
    CHANNEL_CONNECTIONS_BANK_FIELDS_MISSING: "errBankFields",
    CHANNEL_CONNECTIONS_API_KEY_INVALID: "errApiKey",
    CHANNEL_CONNECTIONS_KEYS_INVALID: "errKeys",
    CHANNEL_CONNECTIONS_PAYOS_CONFIRM_REFUSED: "errPayosConfirm",
    CHANNEL_CONNECTIONS_ZALO_FIELDS_INVALID: "errZaloFields",
    CHANNEL_CONNECTIONS_ZALO_TOKEN_REFUSED: "errZaloToken",
    CHANNEL_CONNECTIONS_PROVIDER_UNSUPPORTED: "errGeneric",
}

/** The same message when the transport kept only the HTTP status (the code of a failure is then the status text). */
const STATUS_KEYS: Readonly<Record<string, string>> = { "401": "errForbidden", "403": "errForbidden", "404": "errNone" }

/** The catalog key of a failure code: the table of the domain, else the HTTP status text, else the generic key. */
export const keyOfCode = (code: string, table: Readonly<Record<string, string>>): string =>
    table[code] ?? STATUS_KEYS[code] ?? CHANNEL_FAILURE_KEYS.invalid

/** The catalog key (namespace `connections`) of a channel-connections failure code. */
export const channelMessageKeyOf = (code: string): string => keyOfCode(code, ERROR_KEYS)

/** Sends one channel command through the injected transport and keys a failure by its `connections` sentence. */
export const sendChannel = <T>(request: ChannelRequest): Promise<DbOutcome<T>> =>
    sendRequest<T>(request, channelMessageKeyOf)

/** Sends a channel command whose success has no body and answers `true`. */
export const sendChannelDone = (request: ChannelRequest): Promise<DbOutcome<true>> =>
    sendDone(request, channelMessageKeyOf)
