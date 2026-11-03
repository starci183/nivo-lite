import { isMailAddress } from "@modules/domain/email-messages"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { MANAGEMENT_CONNECTION_IDS, MANAGEMENT_SEED_SCHEMA } from "./management-seed.contracts"
import type { ManagementSeed, ManagementSmtp } from "./management-seed.contracts"

const NAME_MAX = 120
const PORT_MAX = 65_535

type Values = Readonly<Record<string, string>>

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)

const invalid = (field: string): never => {
    throw new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })
}

const textOf = (value: unknown, field: string): string =>
    typeof value === "string" && value.trim() !== "" && value.length <= NAME_MAX * 4 ? value.trim() : invalid(field)

/** The sealed values of a document: every one a text, the names those of the workspace member. */
const valuesOf = (raw: unknown): Values => {
    if (raw === undefined) return {}
    if (!isRecord(raw)) return invalid("values")
    return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, textOf(value, key)]))
}

/** The mail server the values describe: all five of its keys make one, none make none, a part of them is refused. */
const smtpOf = (values: Values): ManagementSmtp | undefined => {
    const [host, port, user, password, from] = ["HOST", "PORT", "USER", "PASSWORD", "FROM"].map(
        (name) => values[`WORKSPACE_SMTP_${name}`],
    )
    if ([host, port, user, password, from].every((value) => value === undefined)) return undefined
    if (host === undefined || port === undefined || user === undefined || password === undefined || from === undefined)
        return invalid("WORKSPACE_SMTP")
    const number = Number(port)
    if (!Number.isInteger(number) || number < 1 || number > PORT_MAX) return invalid("WORKSPACE_SMTP_PORT")
    if (!isMailAddress(from.toLowerCase())) return invalid("WORKSPACE_SMTP_FROM")
    return { host, port: number, user, password, from: from.toLowerCase() }
}

/** The owner address: the sealed one, else the one the document names; both or neither is refused. */
const ownerOf = (document: Record<string, unknown>, values: Values): string => {
    const sealed = values.WORKSPACE_OWNER_EMAIL
    const named = document.ownerEmail === undefined ? undefined : textOf(document.ownerEmail, "ownerEmail")
    const email = (sealed === undefined) === (named === undefined) ? invalid("ownerEmail") : (sealed ?? named ?? "")
    return isMailAddress(email.toLowerCase()) ? email.toLowerCase() : invalid("ownerEmail")
}

/** Reads one management-seed document; a malformed value is refused by the name of its field, never its content. */
export const readManagementSeed = (document: unknown): ManagementSeed => {
    if (!isRecord(document) || document.schema !== MANAGEMENT_SEED_SCHEMA) return invalid("schema")
    const values = valuesOf(document.values)
    return {
        workspaceName: textOf(document.workspaceName, "workspaceName").slice(0, NAME_MAX),
        ownerEmail: ownerOf(document, values),
        smtp: smtpOf(values),
        channels: {
            telegram: { id: MANAGEMENT_CONNECTION_IDS.telegram, token: values.WORKSPACE_TELEGRAM_BOT_TOKEN },
            zaloOa: {
                id: MANAGEMENT_CONNECTION_IDS.zaloOa,
                appId: values.WORKSPACE_ZALO_OA_APP_ID,
                appSecret: values.WORKSPACE_ZALO_OA_APP_SECRET,
                oaSecret: values.WORKSPACE_ZALO_OA_SECRET_KEY,
            },
            sepay: {
                id: MANAGEMENT_CONNECTION_IDS.sepay,
                bankCode: values.WORKSPACE_SEPAY_BANK_CODE,
                accountNumber: values.WORKSPACE_SEPAY_BANK_ACCOUNT,
                holder: values.WORKSPACE_SEPAY_ACCOUNT_HOLDER,
                apiKey: values.WORKSPACE_SEPAY_API_KEY,
            },
            payos: {
                id: MANAGEMENT_CONNECTION_IDS.payos,
                clientId: values.WORKSPACE_PAYOS_CLIENT_ID,
                apiKey: values.WORKSPACE_PAYOS_API_KEY,
                checksumKey: values.WORKSPACE_PAYOS_CHECKSUM_KEY,
            },
        },
    }
}

/** The documents a seed run carries on its stdin: the envelope the stack seed step writes, one line of JSON. */
export const readSeedDocuments = (text: string): ReadonlyArray<unknown> => {
    let envelope: unknown
    try {
        envelope = JSON.parse(text)
    } catch {
        return invalid("input")
    }
    if (!isRecord(envelope) || !Array.isArray(envelope.documents)) return invalid("input")
    return envelope.documents.map((entry: unknown) =>
        isRecord(entry) && "document" in entry ? entry.document : invalid("input"),
    )
}
