import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { ModuleAgentAbilities } from "@nivo-lite/agent-sdk/module"
import type { ProviderAttachmentView } from "@modules/domain/tool-grants"
import { INSTALLED_OPENAPI_ABILITIES, OPENAPI_PROVIDER } from "@modules/domain/openapi-tools"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { ownersOfTool, toolSpecOf } from "@modules/domain/tool-specs"

/** The kind of a provider: a display category and the key an old module declaration names providers by. It limits nothing. */
export type ProviderKind = "messaging" | "payment" | "books" | "mail" | "records" | "domain" | "media"

/**
 * One group of the tools a provider SERVES, named in business words (`customer.send`, `transactions.read`): catalogue INFORMATION (which
 * provider serves which tool, and its display label), never a right. The rights are the agent's attachments and the node's mode alone.
 */
export interface ProviderAbility {
    /** The group id, the same across the providers of a kind that have it (`customer.send`). */
    readonly id: string
    /** `read`: the tools only read the provider; `write`: at least one acts on it (display only: a call's mode is its node's). */
    readonly scope: "read" | "write"
    /** The full names of the tools the group holds. */
    readonly tools: ReadonlyArray<string>
    /**
     * The customer channels the provider serves, for an ability whose tool is one tool for every provider (`nivo.tool.customer.message.send`):
     * the provider is then known only from the conversation, and the tool's executor asks with it.
     */
    readonly channels?: ReadonlyArray<string>
}

/** One provider a workspace can connect, with the tools it serves (grouped for display). */
export interface ProviderSpec {
    /** The provider key, as a connection names it. */
    readonly provider: string
    /** Its kind. */
    readonly kind: ProviderKind
    /** The groups of tools it serves; a provider that serves none cannot be attached. */
    readonly abilities: ReadonlyArray<ProviderAbility>
}

/**
 * The tools that are ONE tool for every provider and answer one part per provider, each part judged as its own call on that provider
 * (`judgeAttachment` with the provider named): `nivo.tool.connection.status.get`. The gateway judges such a tool part by part and hands
 * the adapter the parts it may answer; a part on a provider that serves no tool of it is judged by the road and the node alone.
 */
export const PROVIDER_PARTED_TOOLS: ReadonlySet<string> = new Set([TOOL.connectionStatusGet])

/** True for a tool answered in one part per provider (`PROVIDER_PARTED_TOOLS`). */
export const isProviderParted = (tool: string): boolean => PROVIDER_PARTED_TOOLS.has(tool)

const sendOn = (...channels: ReadonlyArray<string>): ProviderAbility => ({
    id: "customer.send",
    scope: "write",
    tools: [TOOL.customerMessageSend],
    channels,
})

/** The abilities of a domain registrar: every registrar has the same, over the generic domain purposes (`nivo.tool.domain.*`). */
const REGISTRAR_ABILITIES: ReadonlyArray<ProviderAbility> = [
    {
        id: "domain.read",
        scope: "read",
        tools: [TOOL.domainAvailabilityGet, TOOL.domainGet, TOOL.domainList, TOOL.domainDnsRecordList, TOOL.domainRenewalGet],
    },
    {
        id: "domain.register",
        scope: "write",
        tools: [TOOL.domainRegistrationCreate, TOOL.domainRenewalCreate, TOOL.domainTransferCreate],
    },
    {
        id: "dns.write",
        scope: "write",
        tools: [TOOL.domainDnsRecordCreate, TOOL.domainDnsRecordUpdate, TOOL.domainDnsRecordDelete, TOOL.domainNameserverUpdate],
    },
]

/**
 * Every provider and the tools it serves: the mechanics of the providers, in one place (information, not rights). A call of a tool listed
 * here needs the agent's attachment to an account of a provider serving it (`judgeAttachment`, the kill switch), then its node's mode; a
 * tool listed nowhere here needs no account (the node's mode alone). The engine's tool specs (`TOOL_SPECS`) are the source of which providers OWN a core tool:
 * a spec proves this catalogue holds every core tool on exactly its owners (the pseudo-provider `nivo` is never here: a tool listed here
 * is judged only by attachments). `casso`, a second bank feed, holds NIVO's inbox of received credits only: it holds NO payment request
 * (no `qr.create`) until its QR format is verified against Casso's documentation, so it is never a default receiving account and a
 * workspace with a SePay and a Casso account resolves the payment request to the SePay one; `smtp` holds the mail send only (no work action: a node that mails calls the mail tool under its own mode). `payos` is a provider a
 * workspace connects that no tool reaches yet. `openapi` is an API
 * connection that pinned an OpenAPI document: its tools are the ones the installed plugins declare on its connectors
 * (`nivo.tool.<source key>.<method>.<path>`, or the platform purpose an operation serves), ONE ability per operation, so it has no ability
 * until a plugin declares a tool. `nivo.tool.connection.status.get` is ONE tool for every provider, answered in one part per provider
 * (`PROVIDER_PARTED_TOOLS`): `transactions.read` holds it for the SePay part only, and the parts of the providers that do not serve it
 * (Zalo OA, Telegram) need no account.
 */
export const PROVIDER_CATALOGUE: ReadonlyArray<ProviderSpec> = [
    {
        provider: "zalo_oa",
        kind: "messaging",
        abilities: [sendOn("zalo")],
    },
    {
        provider: "telegram",
        kind: "messaging",
        abilities: [sendOn("telegram")],
    },
    {
        provider: "meta",
        kind: "messaging",
        abilities: [
            sendOn("facebook", "instagram"),
            { id: "facebook.publish", scope: "write", tools: [TOOL.facebookPostPublish] },
            { id: "instagram.publish", scope: "write", tools: [TOOL.instagramMediaPublish] },
            { id: "instagram.read", scope: "read", tools: [TOOL.instagramMediaStatusGet] },
        ],
    },
    {
        provider: "sepay",
        kind: "payment",
        abilities: [
            {
                id: "transactions.read",
                scope: "read",
                tools: [TOOL.bankTransactionList, TOOL.paymentCreditList, TOOL.paymentCreditGet, TOOL.paymentDebitList, TOOL.connectionStatusGet],
            },
            // The QR and account details of a bank transfer, composed from the connection's public fields: a read (it creates and moves nothing).
            { id: "transfer.instruction", scope: "read", tools: [TOOL.paymentTransferCreate] },
        ],
    },
    {
        provider: "casso",
        kind: "payment",
        abilities: [
            { id: "transactions.read", scope: "read", tools: [TOOL.paymentCreditList, TOOL.paymentCreditGet] },
        ],
    },
    {
        provider: "payos",
        kind: "payment",
        abilities: [
            { id: "transactions.read", scope: "read", tools: [TOOL.paymentCreditGet] },
            // The hosted payment LINK under payOS's own order code (an operation label for display, a mode never changes with it): created and
            // cancelled at payOS, read back by its id or order code.
            { id: "link.create", scope: "write", tools: [TOOL.paymentLinkCreate] },
            { id: "link.read", scope: "read", tools: [TOOL.paymentLinkGet] },
            { id: "link.cancel", scope: "write", tools: [TOOL.paymentLinkCancel] },
        ],
    },
    {
        provider: "smtp",
        kind: "mail",
        abilities: [{ id: "email.send", scope: "write", tools: [TOOL.mailMessageSend] }],
    },
    {
        provider: "imap",
        kind: "mail",
        abilities: [{ id: "mail.read", scope: "read", tools: [TOOL.mailMessageList, TOOL.mailMessageGet] }],
    },
    {
        provider: "google",
        kind: "books",
        abilities: [
            { id: "ledger.read", scope: "read", tools: [TOOL.ledgerStatusGet] },
            { id: "ledger.write", scope: "write", tools: [TOOL.ledgerEntryAppend, TOOL.ledgerEntryVoid] },
            { id: "drive.read", scope: "read", tools: [TOOL.driveStatusGet, TOOL.driveSourceList] },
            { id: "calendar.read", scope: "read", tools: [TOOL.calendarSlotFreeList] },
            { id: "calendar.write", scope: "write", tools: [TOOL.calendarEventCreate, TOOL.calendarEventUpdate, TOOL.calendarEventCancel] },
            { id: "youtube.read", scope: "read", tools: [TOOL.youtubeVideoStatusGet] },
            { id: "youtube.publish", scope: "write", tools: [TOOL.youtubeVideoPublish] },
        ],
    },
    { provider: OPENAPI_PROVIDER, kind: "records", abilities: INSTALLED_OPENAPI_ABILITIES },
    { provider: "inet", kind: "domain", abilities: REGISTRAR_ABILITIES },
    { provider: "tino", kind: "domain", abilities: REGISTRAR_ABILITIES },
    {
        provider: "elevenlabs",
        kind: "media",
        abilities: [
            { id: "media.read", scope: "read", tools: [TOOL.speechVoiceList, TOOL.dubbingGet] },
            { id: "speech.create", scope: "write", tools: [TOOL.speechGenerate] },
            { id: "dubbing.create", scope: "write", tools: [TOOL.dubbingCreate] },
        ],
    },
    {
        provider: "veo",
        kind: "media",
        abilities: [
            { id: "media.read", scope: "read", tools: [TOOL.videoGenerationGet] },
            { id: "video.create", scope: "write", tools: [TOOL.videoGenerate] },
        ],
    },
    {
        provider: "shotstack",
        kind: "media",
        abilities: [
            { id: "media.read", scope: "read", tools: [TOOL.videoRenderGet] },
            { id: "video.compose", scope: "write", tools: [TOOL.videoCompose] },
        ],
    },
    {
        provider: "creatomate",
        kind: "media",
        abilities: [
            { id: "media.read", scope: "read", tools: [TOOL.videoRenderGet] },
            { id: "video.compose", scope: "write", tools: [TOOL.videoCompose] },
        ],
    },
    {
        provider: "json2video",
        kind: "media",
        abilities: [
            { id: "media.read", scope: "read", tools: [TOOL.videoRenderGet] },
            { id: "video.compose", scope: "write", tools: [TOOL.videoCompose] },
        ],
    },
    {
        provider: "tiktok",
        kind: "media",
        abilities: [
            { id: "tiktok.read", scope: "read", tools: [TOOL.tiktokVideoStatusGet, TOOL.tiktokCreatorInfoGet] },
            { id: "tiktok.publish", scope: "write", tools: [TOOL.tiktokVideoPublish] },
        ],
    },
    // MISA AMIS: a connectable account whose public documentation could not be read, so no operation is built and it owns no purpose.
    { provider: "misa_amis", kind: "books", abilities: [] },
    // MISA meInvoice: the e-invoice provider that serves the issue purpose (owner ruling R57: the invoice is issued AT the provider; NIVO
    // keeps no invoice tool of its own). Its live issue is `not_available` until its documentation is read; a sandbox account answers.
    { provider: "misa_meinvoice", kind: "books", abilities: [{ id: "invoice.issue", scope: "write", tools: [TOOL.invoiceCreate] }] },
]

/** The spec of a provider, or null for a key the catalogue does not know. */
export const providerSpecOf = (provider: string): ProviderSpec | null =>
    PROVIDER_CATALOGUE.find((spec) => spec.provider === provider) ?? null

/** The key of a provider, or null for none. */
export type OptionalProviderKey = string | null

/** The provider a customer channel goes through, or null for a channel of no provider (NIVO's own website chat). */
export const providerOfChannel = (channel: string): OptionalProviderKey =>
    PROVIDER_CATALOGUE.find((spec) => spec.abilities.some((ability) => ability.channels?.includes(channel) === true))
        ?.provider ?? null

/** One ability of one provider. */
interface Held {
    readonly provider: string
    readonly ability: ProviderAbility
}

/** Every ability, of every provider, that holds the tool. */
const holdersOf = (tool: string): ReadonlyArray<Held> =>
    PROVIDER_CATALOGUE.flatMap((spec) =>
        spec.abilities
            .filter((ability) => ability.tools.includes(tool))
            .map((ability) => ({ provider: spec.provider, ability })),
    )

/** The providers on which some ability holds the tool, in catalogue order. */
export const providersHolding = (tool: string): ReadonlyArray<string> => [
    ...new Set(holdersOf(tool).map((held) => held.provider)),
]

/** True for a tool some provider serves: the agent then needs an attachment to an account of one of them. */
export const isProviderTool = (tool: string): boolean => holdersOf(tool).length > 0

/** True for a provider tool whose provider only the conversation tells: its executor asks, not the gateway. */
export const isChannelBound = (tool: string): boolean =>
    holdersOf(tool).some((held) => held.ability.channels !== undefined)

/**
 * True for a provider tool whose provider the call itself tells, so the attachments alone cannot judge a call that names none: a
 * channel-bound tool (its executor asks with the conversation's provider) or a tool answered per provider (the gateway asks part by part).
 */
export const isProviderBound = (tool: string): boolean => isChannelBound(tool) || isProviderParted(tool)

/** The account a call acts on, as far as the caller knows it. */
export interface AccountTarget {
    /** The provider the call goes through (the channel's provider of a send). */
    readonly provider?: string | undefined
    /** The connected account the call acts on (the conversation's connection, the account the ToolRunner handed). */
    readonly connectionId?: string | undefined
}

/**
 * What the rights decide about one call of a provider tool (nivo-frame `rights`): it runs on an attached account (`allow`), it waits for a
 * person on that account (`approval`: the step's node is `ask`, or a write outside every node), or it is refused. The attachment decides
 * only WHETHER the agent may reach an account (the kill switch); the node's mode decides only whether a person is asked first.
 */
export type RightVerdict =
    | { readonly kind: "allow"; readonly provider: string; readonly connectionId: string }
    | { readonly kind: "approval"; readonly provider: string; readonly connectionId: string }
    | {
          readonly kind: "refuse"
          /**
           * `not_attached`: the agent is attached to no account the call may act on (the kill switch); `node_mode_unknown`: the step's
           * node states no readable mode (the engine has no default).
           */
          readonly reason: "not_attached" | "node_mode_unknown"
          /** The providers that serve the tool (of the one the call names, when it names one). */
          readonly providers: ReadonlyArray<string>
          /** The account the call would act on, when the call names one. */
          readonly connectionId?: string | undefined
      }

/** A verdict, or null when the tool is no provider's (or a provider-bound tool names no provider yet). */
export type OptionalRightVerdict = RightVerdict | null

/** What the attachments alone say about a call: an attached account serving it (`allow`), or `not_attached`. */
export type AttachmentVerdict =
    | Extract<RightVerdict, { readonly kind: "allow" }>
    | {
          readonly kind: "refuse"
          readonly reason: "not_attached"
          readonly providers: ReadonlyArray<string>
          readonly connectionId?: string | undefined
      }

/** The attachments over the providers that serve a call: the first attached account serving it, or `not_attached`; null off provider. */
const attachedOf = (
    holders: ReadonlyArray<Held>,
    rows: ReadonlyArray<ProviderAttachmentView>,
    target: AccountTarget,
): AttachmentVerdict | null => {
    const candidates =
        target.provider === undefined ? holders : holders.filter((held) => held.provider === target.provider)
    if (candidates.length === 0) return null
    const reach =
        target.connectionId === undefined ? rows : rows.filter((row) => row.connectionId === target.connectionId)
    for (const held of candidates) {
        const row = reach.find((one) => one.provider === held.provider)
        if (row !== undefined) return { kind: "allow", provider: held.provider, connectionId: row.connectionId }
    }
    return {
        kind: "refuse",
        reason: "not_attached",
        providers: [...new Set(candidates.map((held) => held.provider))],
        ...(target.connectionId === undefined ? {} : { connectionId: target.connectionId }),
    }
}

/**
 * Whether the calling agent is attached to an account that may serve one call of a provider tool, or null when no provider serves the tool
 * (or, for a provider-bound tool, when no provider is named: its executor asks once it knows the conversation). An attachment is to ONE
 * connected account: a call naming its account counts only an attachment to that very account. No mode is read here. Pure.
 */
export const judgeAttachment = (
    rows: ReadonlyArray<ProviderAttachmentView>,
    tool: string,
    target: AccountTarget = {},
): AttachmentVerdict | null => {
    const holders = holdersOf(tool)
    const [first] = holders
    if (first === undefined) return null
    if (
        target.provider === undefined &&
        target.connectionId === undefined &&
        (first.ability.channels !== undefined || isProviderParted(tool))
    )
        return null
    return attachedOf(holders, rows, target)
}

/** True when the attachment is to an account of a provider serving the tool (attachments say WHICH accounts, nothing else). */
export const holdsTool = (row: ProviderAttachmentView, tool: string): boolean =>
    holdersOf(tool).some((held) => held.provider === row.provider)

/**
 * True for a tool that WRITES, by the generic fact of its definition (`mutates`): a core tool by its spec, a tool an installed plugin
 * defines by its `mutates`, an effect always; a tool nothing defines is a write (it may ask, and it never falls back on an unproved
 * failure).
 */
export const mutatesOf = (tool: string): boolean => {
    const held = toolSpecOf(tool)
    if (held !== null) return held.mutates
    const install = INSTALLED.nodeInstall()
    if (install.effects.some((effect) => effect.id === tool)) return true
    return install.tools.find((one) => one.id === tool)?.mutates !== false
}

/**
 * True when an account serves a tool: its provider as nodes name it (`named`, a source key for an OpenAPI account) owns the tool's
 * purpose (`ownersOfTool`), or its stored provider serves the tool in the catalogue.
 */
export const servesTool = (named: string, stored: string, tool: string): boolean =>
    ownersOfTool(tool).includes(named) || holdersOf(tool).some((held) => held.provider === stored)

/** One attached account under the provider key nodes name it by. */
export interface NamedAccount {
    /** The provider key as nodes name it. */
    readonly provider: string
    /** The connected account. */
    readonly connectionId: string
}

/** What a run tells about the accounts of its agent: where its trigger came in, and which accounts its earlier calls used. */
export interface RunAccountFacts {
    /** The connected account the run's triggering event came in on, or null/absent when the event names none. */
    readonly triggerConnectionId?: string | null | undefined
    /** The connected accounts the run's earlier calls used, the most recent first (the tool call log of the run). */
    readonly usedConnectionIds?: ReadonlyArray<string> | undefined
}

/** Why one account was picked among the agent's accounts of one provider: it is the only one, or the first rule of the order that names one. */
export type AccountPickedBy = "only" | "trigger" | "run" | "default"

/** The account a call uses among the agent's attached accounts of ONE provider, or why none is. */
export type AccountPick<A extends NamedAccount> =
    | { readonly kind: "none" }
    | { readonly kind: "picked"; readonly account: A; readonly by: AccountPickedBy }
    | { readonly kind: "needs_pick"; readonly candidates: ReadonlyArray<A> }

/**
 * THE ONE ORDER (generic, nivo-frame `rights`): which of an agent's attached accounts of ONE provider a step's call uses. None attached:
 * `none` (the kill switch). One attached: it, exactly as before (`only`). Several, the first rule that names one of them wins:
 * (1) the account the run's triggering event came in on (`run.triggerConnectionId`); (2) an account the run already used earlier
 * (`run.usedConnectionIds`, the most recent first); (3) the agent's DEFAULT account of the provider, the one the owner set
 * (`defaultConnectionId`); else `needs_pick` with the candidates (never a guess: the owner picks a default). A fact naming an account
 * that is not among the candidates names nothing. Pure.
 */
export const pickAccountOf = <A extends NamedAccount>(
    own: ReadonlyArray<A>,
    defaultConnectionId: string | null,
    run: RunAccountFacts = {},
): AccountPick<A> => {
    const [only, ...more] = own
    if (only === undefined) return { kind: "none" }
    if (more.length === 0) return { kind: "picked", account: only, by: "only" }
    const named = (connectionId: string | null | undefined): A | undefined =>
        connectionId === null || connectionId === undefined ? undefined : own.find((account) => account.connectionId === connectionId)
    const byTrigger = named(run.triggerConnectionId)
    if (byTrigger !== undefined) return { kind: "picked", account: byTrigger, by: "trigger" }
    for (const used of run.usedConnectionIds ?? []) {
        const byRun = named(used)
        if (byRun !== undefined) return { kind: "picked", account: byRun, by: "run" }
    }
    const byDefault = named(defaultConnectionId)
    if (byDefault !== undefined) return { kind: "picked", account: byDefault, by: "default" }
    return { kind: "needs_pick", candidates: own }
}

/** One provider the agent holds several accounts of and no rule of the order names one: the choice the owner has to make. */
export interface PickNeeded {
    /** The provider (as nodes name it). */
    readonly provider: string
    /** The attached accounts of it, one of which the owner picks as the default. */
    readonly connectionIds: ReadonlyArray<string>
}

/** The pick of each provider a node lists, in the node's order, each once. */
const picksOf = <A extends NamedAccount>(
    providers: ReadonlyArray<string>,
    attached: ReadonlyArray<A>,
    defaultOf: (provider: string) => string | null,
    run: RunAccountFacts | undefined,
): ReadonlyArray<{ readonly provider: string; readonly pick: AccountPick<A> }> =>
    [...new Set(providers)].map((provider) => ({
        provider,
        pick: pickAccountOf(
            attached.filter((account) => account.provider === provider),
            defaultOf(provider),
            run,
        ),
    }))

/**
 * THE BINDING (nivo-frame `rights`, `templates`): the accounts a node's call may act on, in the NODE'S order of providers. Each provider
 * the node lists binds the agent's ONE attached account of it; of several, the account `pickAccountOf` names (the run's trigger, then the
 * run's earlier calls, then the agent's default account of the provider, `defaultOf`), else none (never a guess: readiness names it
 * `needs_pick`, and `unpickedOf` the choice). A provider the agent has no account of binds nothing (the kill switch). Pure.
 */
export const bindNodeProviders = <A extends NamedAccount>(
    providers: ReadonlyArray<string>,
    attached: ReadonlyArray<A>,
    defaultOf: (provider: string) => string | null,
    run?: RunAccountFacts,
): ReadonlyArray<A> =>
    picksOf(providers, attached, defaultOf, run).flatMap(({ pick }) => (pick.kind === "picked" ? [pick.account] : []))

/**
 * The providers of a node whose several attached accounts no rule of the order picks from (`bindNodeProviders` binds nothing for them),
 * in the node's order, each with its candidate accounts: what the typed refusal names. Pure.
 */
export const unpickedOf = <A extends NamedAccount>(
    providers: ReadonlyArray<string>,
    attached: ReadonlyArray<A>,
    defaultOf: (provider: string) => string | null,
    run?: RunAccountFacts,
): ReadonlyArray<PickNeeded> =>
    picksOf(providers, attached, defaultOf, run).flatMap(({ provider, pick }) =>
        pick.kind === "needs_pick" ? [{ provider, connectionIds: pick.candidates.map((account) => account.connectionId) }] : [],
    )

/** What a module that ships no template agent still declares (`agent.abilities`), or undefined when it declares nothing. */
export type OptionalModuleDeclaration = ModuleAgentAbilities | undefined

/** True for a declared entry that names its provider at all (`auto` or `ask`; `off` and anything else names nothing). */
const namesAny = (entries: Readonly<Record<string, string | undefined>> | undefined): boolean =>
    Object.values(entries ?? {}).some((mode) => mode === "auto" || mode === "ask")

/**
 * The providers of the catalogue a module's OLD declaration (`agent.abilities`, a module with no template agent) names, by kind or by
 * key, in catalogue order: only which providers its fresh agent is attached to; the modes it once wrote are read as nothing (a mode is
 * the node's). A provider that serves no tool is never named.
 */
export const providersOfDeclaration = (declared: OptionalModuleDeclaration): ReadonlyArray<string> =>
    PROVIDER_CATALOGUE.filter(
        (spec) =>
            spec.abilities.length > 0 &&
            (namesAny(declared?.kinds?.[spec.kind]) || namesAny(declared?.providers?.[spec.provider])),
    ).map((spec) => spec.provider)
