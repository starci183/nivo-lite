/** What the owner typed on the first step of the Zalo wizard. */
export interface ZaloAppInput {
    readonly name: string
    readonly appId: string
    readonly appSecret: string
}

/** The OA Secret Key the owner pasted for a connection. */
export interface ZaloOaSecretInput {
    readonly connectionId: string
    readonly oaSecret: string
}

/** Which part of the input a refusal names. */
export type ZaloWizardField =
    "input" | "name" | "app-id" | "app-secret" | "connection" | "oa-secret" | "state" | "code" | "oa-id"

/** The answer of a schema: the parsed data, or the part of the input that was refused. */
export type ZaloWizardParse<Data> =
    { readonly success: true; readonly data: Data } | { readonly success: false; readonly field: ZaloWizardField }

/** The longest app id, name or key the wizard accepts. */
const FIELD_MAX = 200

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

const fits = (value: string): boolean => value.length > 0 && value.length <= FIELD_MAX

/** Bounds the app keys before anything reads them. */
export const zaloAppSchema = {
    safeParse: (input: unknown): ZaloWizardParse<ZaloAppInput> => {
        if (!isRecord(input)) return { success: false, field: "input" }
        const name = textOf(input.name)
        const appId = textOf(input.appId)
        const appSecret = textOf(input.appSecret)
        if (!fits(name)) return { success: false, field: "name" }
        if (!fits(appId)) return { success: false, field: "app-id" }
        if (!fits(appSecret)) return { success: false, field: "app-secret" }
        return { success: true, data: { name, appId, appSecret } }
    },
}

/** Bounds the OA Secret Key and the connection it belongs to. */
export const zaloOaSecretSchema = {
    safeParse: (input: unknown): ZaloWizardParse<ZaloOaSecretInput> => {
        if (!isRecord(input)) return { success: false, field: "input" }
        const connectionId = textOf(input.connectionId)
        const oaSecret = textOf(input.oaSecret)
        if (!fits(connectionId)) return { success: false, field: "connection" }
        if (!fits(oaSecret)) return { success: false, field: "oa-secret" }
        return { success: true, data: { connectionId, oaSecret } }
    },
}

/** Bounds the connection the permission page is built for. */
export const zaloConnectionSchema = {
    safeParse: (input: unknown): ZaloWizardParse<string> => {
        const connectionId = textOf(input)
        return fits(connectionId) ? { success: true, data: connectionId } : { success: false, field: "connection" }
    },
}

/** What Zalo sends the browser back with after the owner granted the OA permissions. */
export interface ZaloReturnInput {
    readonly state: string
    readonly code: string
    readonly oaId?: string
}

/** The longest state, code or OA id taken from the address bar. */
const RETURN_FIELD_MAX = 600

const returnFits = (value: string): boolean => value.length > 0 && value.length <= RETURN_FIELD_MAX

/** Bounds what the address bar carried back from Zalo before anything reads it. */
export const zaloReturnSchema = {
    safeParse: (input: unknown): ZaloWizardParse<ZaloReturnInput> => {
        if (!isRecord(input)) return { success: false, field: "input" }
        const state = typeof input.state === "string" ? input.state : ""
        const code = typeof input.code === "string" ? input.code : ""
        const oaId = typeof input.oaId === "string" ? input.oaId : undefined
        if (!returnFits(state)) return { success: false, field: "state" }
        if (!returnFits(code)) return { success: false, field: "code" }
        if (oaId !== undefined && !returnFits(oaId)) return { success: false, field: "oa-id" }
        return { success: true, data: { state, code, ...(oaId === undefined ? {} : { oaId }) } }
    },
}
