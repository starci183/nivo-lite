import { isProvider } from "@/hooks/connection-providers"
import type {
    ConnectionAgentType,
    ConnectionCheckType,
    ConnectionType,
    FirstEventStateType,
    FirstEventType,
    MetaAppObjectType,
    MetaCheckType,
    MetaWizardConnectionType,
    WebhookTestResultType,
    WebhookViewType,
    WizardConnectionType,
    ZaloWizardConnectionType,
} from "@/modules/api"
import type {
    Access,
    AgentOption,
    Connection,
    ConnectionCheck,
    ConnectionStatus,
    Environment,
    FirstEvent,
    FirstEventState,
    MetaCheck,
    MetaCheckSummary,
    MetaWizardConnection,
    WebhookTestVerdict,
    WebhookView,
    WizardConnection,
    ZaloWizardConnection,
} from "@/modules/types"

const statusOf = (value: string): ConnectionStatus =>
    value === "pending" || value === "error" || value === "disconnected" ? value : "connected"
const environmentOf = (value: string): Environment => (value === "test" ? "test" : "live")
const accessOf = (value: string): Access => (value === "read" || value === "ask" ? value : "auto")

const metaOf = (value: unknown): Readonly<Record<string, string>> => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {}
    return Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    )
}

/** The first event of the wire, or none. */
export const firstEventOf = (value: FirstEventType | null | undefined): FirstEvent | null =>
    value === null || value === undefined ? null : { amount: value.amount, content: value.content, at: value.at }

/** The console row of one wire connection; none when the provider is not one the console offers. */
export const connectionOf = (value: ConnectionType): Connection | null => {
    if (!isProvider(value.provider)) return null
    return {
        id: value.id,
        workspaceId: value.workspaceId,
        provider: value.provider,
        name: value.name,
        meta: metaOf(value.meta),
        status: statusOf(value.status),
        lastError: value.lastError ?? null,
        environment: environmentOf(value.environment),
        isDefault: value.isDefault,
        lastEventAt: value.lastEventAt ?? null,
        firstEvent: firstEventOf(value.firstEvent),
        agentIds: value.agentIds,
        grants: value.grants.map((grant) => ({ agentId: grant.agentId, access: accessOf(grant.access) })),
    }
}

/** The console rows of the wire connections (a provider the console does not know is left out). */
export const connectionsOf = (values: ReadonlyArray<ConnectionType>): ReadonlyArray<Connection> =>
    values.flatMap((value) => {
        const connection = connectionOf(value)
        return connection === null ? [] : [connection]
    })

/** One workspace agent as the connections console lists it. */
export const agentOptionOf = (value: ConnectionAgentType): AgentOption => ({
    id: value.id,
    name: value.name,
    module: value.module,
})

/** What a first-event poll answers. */
export const firstEventStateOf = (value: FirstEventStateType): FirstEventState => ({
    status: statusOf(value.status),
    firstEvent: firstEventOf(value.firstEvent),
})

/** The Meta wizard view of a connection. */
export const metaWizardOf = (value: MetaWizardConnectionType): MetaWizardConnection => ({
    id: value.id,
    name: value.name,
    status: statusOf(value.status),
    configured: value.configured,
    pages: value.pages.map((page) => ({
        id: page.id,
        name: page.name,
        category: page.category,
        igId: page.igId,
        igUsername: page.igUsername,
    })),
    pageId: value.pageId,
    pageName: value.pageName,
    igId: value.igId,
    igUsername: value.igUsername,
    firstEvent: firstEventOf(value.firstEvent),
    agentIds: value.agentIds,
})

const appObjectOf = (value: MetaAppObjectType | null | undefined): MetaCheck["appPage"] =>
    value === null || value === undefined
        ? null
        : { callbackUrl: value.callbackUrl, fields: value.fields, missing: value.missing, urlMatches: value.urlMatches }

/** What Meta really has for a connection. */
export const metaCheckOf = (value: MetaCheckType): MetaCheck => ({
    ok: value.ok,
    tokenOk: value.tokenOk,
    pageId: value.pageId,
    pageName: value.pageName,
    igUsername: value.igUsername,
    page: {
        subscribed: value.pageSubscription.subscribed,
        fields: value.pageSubscription.fields,
        missing: value.pageSubscription.missing,
    },
    appPage: appObjectOf(value.appPage),
    appInstagram: appObjectOf(value.appInstagram),
    appKnown: value.appKnown,
    webhookUrl: value.webhookUrl,
    localOnly: value.localOnly,
    verifyTokenSet: value.verifyTokenSet,
    repaired: value.repaired,
})

/** The money wizard view of a bank or payment connection. */
export const wizardConnectionOf = (value: WizardConnectionType): WizardConnection => ({
    id: value.id,
    provider: isProvider(value.provider) ? value.provider : "sepay",
    name: value.name,
    environment: environmentOf(value.environment),
    status: statusOf(value.status),
    webhookUrl: value.webhookUrl,
    apiKey: value.apiKey,
    bank: "",
    bankCode: value.bankCode,
    account: value.account,
    holder: value.holder,
    credentialsSaved: value.credentialsSaved,
    firstEvent: firstEventOf(value.firstEvent),
    agentIds: value.agentIds,
})

/** The Zalo wizard view of an Official Account connection. */
export const zaloWizardOf = (value: ZaloWizardConnectionType): ZaloWizardConnection => ({
    id: value.id,
    name: value.name,
    status: statusOf(value.status),
    webhookUrl: value.webhookUrl,
    callbackUrl: value.callbackUrl,
    authorized: value.authorized,
    oaSecretSaved: value.oaSecretSaved,
    oaId: value.oaId,
    firstEvent: firstEventOf(value.firstEvent),
    agentIds: value.agentIds,
})

/** What a Telegram or Zalo check answers. */
export const connectionCheckOf = (value: ConnectionCheckType): ConnectionCheck => ({
    provider: isProvider(value.provider) ? value.provider : "telegram",
    webhookOk: value.webhookOk,
    localOnly: value.localOnly,
    pending: value.pending,
    lastError: value.lastError ?? null,
})

/** The short verdict a Meta row shows. */
export const metaCheckSummaryOf = (value: MetaCheckType): MetaCheckSummary => ({
    ok: value.ok,
    tokenOk: value.tokenOk,
    page: { fields: value.pageSubscription.fields },
})

/** What a signed webhook test answers. */
export const webhookVerdictOf = (value: WebhookTestResultType): WebhookTestVerdict => ({
    ok: value.ok,
    status: value.status ?? null,
    error: value.error ?? null,
    durationMs: value.durationMs,
})

/** The outgoing webhook as the wizard shows it. */
export const webhookViewOf = (value: WebhookViewType): WebhookView => ({
    id: value.id,
    name: value.name,
    host: value.host,
    events: value.events,
    signingSecret: value.signingSecret,
})
