import { ConnectionBindingsReadService, ConnectionSecretReadsService } from "@modules/domain/connections"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { coversEachAccount, soleAccountOf } from "./native-account.policy"
import {
    ToolsError,
    ToolsErrorCode,
    AgentAccountsService,
    reaskSeenOf,
    type ToolJson,

    type NativeCaller,
    type ToolManifest,
    type ManifestTool,
} from "@modules/domain/tools"
import {
    ENVELOPE_ANSWERS,
    OPENAPI_PROVIDER,
    accountBaseOf,
    accountFactsOf,
    accountKeyOf,
    argumentsSchemaOf,
    baseUrlProblemOf,
    installedDeclarationsOf,
    operationOfApiVerb,
    pinnedTextOf,
    plannedRequestOf,
    readDocument,
    resolvedProblemOf,
    sourceApiPrefixOf,
    sourcePrefixOf,
    toolOutcomeOf,
    type AccountBase,
    type AccountKey,
    type DocumentReading,
    type JsonMembers,
    type OpenApiToolDeclaration,
    type PinnedDocument,
    type PinnedOperation,
    type PlannedRequest,
    type SchemaNode,
    type ToolsAccountFacts,
} from "@modules/domain/openapi-tools"
import { DataSourcesError, DataSourcesErrorCode, type OpenApiClient, type PublicHostClient } from "@modules/integrations/data-sources"
import type { Clock } from "@modules/platform/clock"
import { isRecord } from "@modules/platform/primitives"
import { withProof } from "@modules/domain/provider-registry"
import { nativeRefusalParamsOf, type NativeRefusalReason } from "./native-refusal.policy"
import { OPENAPI_ARGUMENTS_SCHEMA } from "./openapi-native.schema"

/** The most accounts of the provider a workspace is read for. */
const ACCOUNTS_MAX = 20

/** Where an outside system serves its live document, under its base URL. */
const DOCUMENT_PATH = "/openapi.json"

/** How long a look at the live document is trusted, milliseconds: at most one look per account in that time. */
const LIVE_CHECK_MS = 600_000

/** The largest answer of one call, bytes; a larger one is refused by the client, never cut in the middle. */
const ANSWER_MAX_BYTES = 1_000_000

/** The per-call limit of the connector: an outside system may take longer than NIVO's own reads. */
const CONNECTOR_TIMEOUT_MS = 15_000

/** The members of an answer the audit never keeps: what the outside system holds about people, and what it said. */
const ANSWER_SECRET_FIELDS: ReadonlyArray<string> = ["data", "message"]

/** The argument types the audit keeps as they are: a count, a switch. Any other argument may name a person and is masked. */
const PLAIN_ARGUMENT_TYPES: ReadonlySet<unknown> = new Set(["boolean", "integer", "number"])

/** What reading a tool's arguments answers: whether they fit. */
export interface ToolArgumentReading {
    /** True when the arguments fit. */
    readonly success: boolean
}

/** The validator a plugin declares for a tool's arguments, as far as the connector uses it. */
export interface ToolArgumentReader {
    /** Reads the arguments. */
    safeParse(args: unknown): ToolArgumentReading
}

/** One declared tool with what the manifest announces of it. */
export interface OpenApiToolSource {
    /** What the plugin declares of the tool. */
    readonly declaration: OpenApiToolDeclaration
    /** The plugin's validator of its arguments. */
    readonly args: ToolArgumentReader
    /** The schema the tool announces. */
    readonly inputSchema: ToolJson
    /** What the tool does, in the plugin's own words (never the document's). */
    readonly description: string
}

/** The trusted link from a conversation to the customer of the outside system it belongs to, on one connected account. */
export interface OpenApiCustomerLinks {
    /**
     * The customer identity the conversation's customer is linked to on the account that serves the call, or null when nobody linked
     * it there. A link is a person's decision (or a step's call a person approved); it is never read from what a caller says.
     */
    customerOf(workspaceId: string, conversationId: string, connectionId: string): Promise<string | null>
}

/** What the connector reaches the workspace's account and the outside system through; an app that lacks one serves no call. */
export interface OpenApiConnectorPorts {
    /** The connections of a workspace and their public facts. */
    readonly bindings: Pick<ConnectionBindingsReadService, "ofProvider" | "recordOf">
    /** The time, for the look at the live document. */
    readonly clock: Clock
    /** Opens the sealed key of a connection; absent in an app that holds no connection key. */
    readonly secrets?: Pick<ConnectionSecretReadsService, "secretOf"> | undefined
    /** Calls the outside system; absent in an app that makes no outbound call. */
    readonly client?: Pick<OpenApiClient, "call" | "fetchSpec"> | undefined
    /** Resolves a host and says whether the site is a development one. */
    readonly host?: Pick<PublicHostClient, "allowsPrivate" | "resolve"> | undefined
    /**
     * The customer of the outside system a conversation is linked to on an account, set only by a person or by a step's call a person
     * approved; absent (or null), a run that serves a customer reads no customer-specific data.
     */
    readonly customerLinks?: OpenApiCustomerLinks | undefined
    /** The rights of agents on connected accounts; absent, every open account serves. */
    readonly abilities?: Pick<AgentAccountsService, "accountsOfAgent"> | undefined
}

/** An account ready to serve a call. */
interface Account {
    /** The connection. */
    readonly connectionId: string
    /** What it says about its tools. */
    readonly facts: ToolsAccountFacts
    /** Its public facts. */
    readonly meta: Readonly<Record<string, string>>
}

/** One call ready to send. */
interface Sending {
    /** Where the account's API is. */
    readonly base: AccountBase
    /** The opened key. */
    readonly key: AccountKey
    /** The operation. */
    readonly operation: PinnedOperation
    /** The planned request. */
    readonly request: PlannedRequest
}

/** The operation of a call with the account that serves it. */
interface ServedOperation {
    /** The operation of the pinned document. */
    readonly operation: PinnedOperation
    /** The connection of the account. */
    readonly connectionId: string
}

/** The account a person's read is served by, with where its API is and its pinned document. */
interface Viewed {
    /** The account. */
    readonly account: Account
    /** Where its API is. */
    readonly base: AccountBase
    /** Its pinned document. */
    readonly document: PinnedDocument
}

/** A pinned document as it was last read for an account. */
interface ReadPin {
    /** The stored text it was read from. */
    readonly text: string
    /** What reading it came to. */
    readonly reading: DocumentReading
}

/** The last look at an account's live document. */
interface LiveLook {
    /** When, epoch ms. */
    readonly at: number
    /** Its pin, or null when the outside system handed no readable document. */
    readonly sha: string | null
}

/** One operation a person may read on a screen: a GET operation the pinned document serves and supports. */
export interface OpenApiViewerRead {
    /** The raw API read (`nivo.api.crm.get.customers`), the name of the read: never a tool id. */
    readonly name: string
    /** The schema of its flat arguments. */
    readonly input: SchemaNode
    /** The schema of its 200 answer, or null when the document declares none. */
    readonly output: SchemaNode | null
}

/**
 * The accounts on which the calling agent holds the tool. A call that states where it came from (its road, its workflow step) hands
 * that on for the shadow compare of the node-level rights; the answer is the same either way.
 */
const heldBy = (
    abilities: Pick<AgentAccountsService, "accountsOfAgent">,
    workspaceId: string,
    caller: NativeCaller,
    tool: string,
): Promise<ReadonlyArray<string>> => {
    const seen = reaskSeenOf(caller)
    return seen === undefined
        ? abilities.accountsOfAgent(workspaceId, caller.agentId, tool)
        : abilities.accountsOfAgent(workspaceId, caller.agentId, tool, seen)
}

/** The caller of a person's read: no agent, so no agent right is judged; the workspace's own account serves. */
const VIEWER: NativeCaller = { agentId: "", conversationId: null, engine: true }

/** What a refusal of an expected case is thrown with (its reason and the class its source gives it): an answer to the caller, never a failure of the connector. */
const refusedAs = (reason: NativeRefusalReason, cause?: unknown): ConstructorParameters<typeof ToolsError>[0] => ({
    code: ToolsErrorCode.NativeRefused,
    params: nativeRefusalParamsOf(reason),
    ...(cause === undefined ? {} : { cause }),
})

/** The arguments of a tool the audit masks: every one that is not a count or a switch. */
const maskedArgumentsOf = (schema: ToolJson): ReadonlyArray<string> =>
    Object.entries(isRecord(schema.properties) ? schema.properties : {}).flatMap(([name, member]) =>
        isRecord(member) && !PLAIN_ARGUMENT_TYPES.has(member.type) ? [name] : [],
    )

const toolSpecOf = (source: OpenApiToolSource): ManifestTool => {
    const { reads } = source.declaration
    return {
        name: source.declaration.name,
        description: source.description,
        scope: reads ? "read" : "write",
        defaultMode: reads ? "auto" : "ask",
        inputSchema: source.inputSchema,
        argumentSchema: OPENAPI_ARGUMENTS_SCHEMA,
        secretFields: [...ANSWER_SECRET_FIELDS, ...maskedArgumentsOf(source.inputSchema)],
    }
}

/**
 * The manifest of the connector of one CRM: key `<provider key>` (`crm.nivoweb`), namespace `nivo.api.crm.<crmId>`, one tool per operation
 * the installed plugins declare on it, named by the rest of its name (`get.prices`): a tool's full name is the operation's ONE name
 * (`nivo.api.crm.nivoweb.get.prices`).
 */
export const openApiManifestOf = (connector: string, sources: ReadonlyArray<OpenApiToolSource>): ToolManifest => ({
    key: connector,
    namespace: sourcePrefixOf(connector).slice(0, -1),
    name: `CRM ${connector}`,
    contractVersion: "openapi-tools@2",
    timeoutMs: CONNECTOR_TIMEOUT_MS,
    tools: sources.map((source) => toolSpecOf(source)),
    // Every answer is the response policy's envelope: the node door hands a template node its body apart from its meta.
    answers: ENVELOPE_ANSWERS,
})

/** The tools the installed plugins declare on a source, with the words and the validator each declares. */
export const installedSourcesOf = (connector: string): ReadonlyArray<OpenApiToolSource> =>
    installedDeclarationsOf(connector).flatMap((declaration): Array<OpenApiToolSource> => {
        const tool = INSTALLED.toolOf(declaration.tool)
        if (tool === null) return []
        const summary = INSTALLED.toolLabelOf(declaration.tool)?.summary.en
        const announced: unknown = tool.args.toJSONSchema({ io: "input", unrepresentable: "any" })
        return [
            {
                declaration,
                args: tool.args,
                inputSchema: isRecord(announced) ? announced : { type: "object" },
                description: summary ?? `Operation ${declaration.name} of the connected ${connector} system.`,
            },
        ]
    })

/**
 * Runs the operations of one CRM (provider key `crm.<crmId>`) against the workspace's CRM connection that serves it (an `openapi`
 * connection whose pinned snapshot is of that CRM id). Only the operations a plugin declared are tools,
 * each found in the pinned document by its tool id (the document's id index; the id is never parsed back into a path); the document is data that says how each is called and what it
 * answers, never words for a model. Every call: the account the calling agent is attached to; it never asks a person (the node's mode is judged by the ToolRunner before this runs); the base URL must be allowed; the stored document must still be the
 * pinned one, and so must the live one when it can be read; the operation must exist, be supported and be a read when the tool was
 * declared one; the arguments are checked and placed; the answer is checked against the document, cut to it and bounded. The key is
 * opened here only to be handed to the client, which writes it into the request header.
 */
export class OpenApiConnectorService {
    /** The manifest the gateway lists the connector by. */
    readonly manifest: ToolManifest
    private readonly sources: ReadonlyMap<string, OpenApiToolSource>
    private readonly documents = new Map<string, ReadPin>()
    private readonly lives = new Map<string, LiveLook>()

    constructor(
        private readonly connector: string,
        sources: ReadonlyArray<OpenApiToolSource>,
        private readonly ports: OpenApiConnectorPorts,
    ) {
        this.manifest = openApiManifestOf(connector, sources)
        this.sources = new Map(sources.map((source) => [source.declaration.name, source]))
    }

    /**
     * Runs one declared tool; any other name is unknown. A failure says what it proves about the call's effect by WHERE it happened
     * (`withProof`): anything before the request is handed to the client (the account, the document, the arguments,
     * the key) is `not_sent`; the client's own failure and a 5xx answer are `unknown` (the request may have reached the system). A
     * 4xx is the system's answer (a refusal), not a failure.
     */
    async invoke(workspaceId: string, tool: string, args: JsonMembers, caller: NativeCaller): Promise<ToolJson> {
        const { client } = this.ports
        const sending = await this.prepared(workspaceId, tool, args, caller).catch((cause: unknown) => {
            throw withProof(cause, "not_sent")
        })
        if (client === undefined) throw withProof(new ToolsError(refusedAs("not_served")), "not_sent")
        return this.send(client, sending)
    }

    /** Everything a call is checked and planned by before its request leaves: what `invoke` hands the client. */
    private async prepared(workspaceId: string, tool: string, args: JsonMembers, caller: NativeCaller): Promise<Sending> {
        const source = this.sources.get(tool)
        if (source === undefined) throw new ToolsError({ code: ToolsErrorCode.UnknownTool, params: { tool } })
        const { declaration } = source
        const { client, secrets } = this.ports
        if (client === undefined || secrets === undefined) throw new ToolsError(refusedAs("not_served"))
        const account = await this.accountOf(workspaceId, caller, declaration.tool)
        const base = accountBaseOf(account.meta)
        if (base === null) throw new ToolsError(refusedAs("not_connected"))
        await this.requireReachable(base)
        const document = await this.pinnedOf(account, base, client)
        const operation = this.operationOf(document, declaration)
        const bound = await this.boundArgumentsOf(workspaceId, caller, { operation, connectionId: account.connectionId }, args)
        if (!source.args.safeParse(bound).success) {
            throw new ToolsError({ code: ToolsErrorCode.InvalidArguments, params: { tool } })
        }
        const planned = plannedRequestOf(operation, account.facts, document.securityHeaders, bound, {
            workspaceId,
            tool: declaration.tool,
            stepKey: caller.opKey ?? null,
        })
        if (!planned.ok) throw new ToolsError({ code: ToolsErrorCode.InvalidArguments, params: { tool } })
        const key = await this.keyOf(workspaceId, account, base, secrets)
        return { base, key, operation, request: planned.request }
    }

    /**
     * The arguments a call runs with. An internal run: as given. A run that serves a customer (it has a conversation, or acts for a
     * customer): only an operation the document opens to customers (`internal_only` otherwise). An operation opened to customers
     * that names no customer parameter (a price list, a record keyed by the conversation) runs as given, link or no link. One that
     * names its customer parameter never takes it from the caller: it is the customer the conversation is linked to on the account
     * that serves the call. No link: `customer_not_linked`. Another customer named: `other_customer`.
     */
    private async boundArgumentsOf(
        workspaceId: string,
        caller: NativeCaller,
        served: ServedOperation,
        args: JsonMembers,
    ): Promise<JsonMembers> {
        const { operation } = served
        const outsider = caller.engine !== true && (caller.conversationId !== null || caller.run?.origin === "customer")
        if (!outsider) return args
        if (!operation.customerAudience) throw new ToolsError(refusedAs("internal_only"))
        const parameter = operation.customerParameter
        if (parameter === null) return args
        const { customerLinks } = this.ports
        const linked =
            customerLinks === undefined || caller.conversationId === null
                ? null
                : await customerLinks.customerOf(workspaceId, caller.conversationId, served.connectionId)
        if (linked === null) throw new ToolsError(refusedAs("customer_not_linked"))
        const named = args[parameter]
        if (named !== undefined && named !== linked) throw new ToolsError(refusedAs("other_customer"))
        return { ...args, [parameter]: linked }
    }

    /** The account of the source and its pinned document, for a person's read; null where nothing can be read. */
    private async viewedOf(workspaceId: string): Promise<Viewed | null> {
        const { client } = this.ports
        if (client === undefined) return null
        const account = await this.accountOf(workspaceId, VIEWER, null)
        const base = accountBaseOf(account.meta)
        if (base === null) return null
        await this.requireReachable(base)
        return { account, base, document: await this.pinnedOf(account, base, client) }
    }

    /**
     * The reads a person may run on a screen in this workspace (level 1 of the provider, interface reads): one per GET operation the
     * pinned document serves under the source's base path and supports, named by its API read (`nivo.api.<key>.<method>.<path>`,
     * never a tool id), with the schemas built from that operation. None for a workspace with no account of the connector; a
     * document that is no longer the pinned one stops them as it stops the tools.
     */
    async viewerReads(workspaceId: string): Promise<ReadonlyArray<OpenApiViewerRead>> {
        const viewed = await this.viewedOf(workspaceId)
        if (viewed === null) return []
        const { account, document } = viewed
        return [...document.operations.values()].flatMap((operation): Array<OpenApiViewerRead> => {
            if (operation.method !== "GET" || operation.unsupported.length > 0) return []
            return [
                {
                    name: operation.apiVerb,
                    input: argumentsSchemaOf(operation, account.facts, document.securityHeaders),
                    output: operation.responses["200"] ?? null,
                },
            ]
        })
    }

    /**
     * Runs one read for a person looking at a screen, named by its API read (`nivo.api.<key>.<method>.<path>`): the same account,
     * pinned document, key and workspace header as the tools, with no agent involved and the arguments checked against the
     * document. Only a GET operation of the source's pinned document is served (`not_selected` otherwise: a tool id, a write, an
     * operation the document lacks or does not support).
     */
    async viewerRead(workspaceId: string, name: string, args: JsonMembers): Promise<ToolJson> {
        if (!name.startsWith(sourceApiPrefixOf(this.connector))) throw new ToolsError(refusedAs("not_selected"))
        const { client, secrets } = this.ports
        if (client === undefined || secrets === undefined) throw new ToolsError(refusedAs("not_served"))
        const viewed = await this.viewedOf(workspaceId)
        if (viewed === null) throw new ToolsError(refusedAs("not_connected"))
        const { account, base, document } = viewed
        const operation = operationOfApiVerb(document, name)
        if (operation?.method !== "GET" || operation.unsupported.length > 0) throw new ToolsError(refusedAs("not_selected"))
        const planned = plannedRequestOf(operation, account.facts, document.securityHeaders, args, {
            workspaceId,
            tool: name,
            stepKey: null,
        })
        if (!planned.ok) throw new ToolsError({ code: ToolsErrorCode.InvalidArguments, params: { tool: name } })
        const key = await this.keyOf(workspaceId, account, base, secrets)
        return this.send(client, { base, key, operation, request: planned.request })
    }

    /**
     * The account a call runs on, never a silent pick (ARCH-REVIEW 2026-11-12 S7). The candidates are the open accounts of the
     * workspace that serve the connector, narrowed for an agent to those on which it holds the tool. A call the tool runner handed ONE
     * account (`caller.connectionId`) runs on that account when it is a candidate, and is refused `not_connected` when it is not. With
     * no account handed: an agent's write or single-account operation is refused `not_connected` (the runner hands the account it
     * chose; none handed means none is bound); an agent's `each` read, the engine's own caller and a person's read (`tool` null) run
     * on the ONE candidate (`soleAccountOf`: several are `not_selected`, none `not_connected`).
     */
    private async accountOf(workspaceId: string, caller: NativeCaller, tool: string | null): Promise<Account> {
        const { abilities, bindings } = this.ports
        const all = await bindings.ofProvider(workspaceId, OPENAPI_PROVIDER, ACCOUNTS_MAX)
        const held =
            abilities === undefined || caller.engine === true || tool === null
                ? null
                : await heldBy(abilities, workspaceId, caller, tool)
        const open = all.filter((entry) => entry.status !== "disconnected" && (held === null || held.includes(entry.id)))
        const records = await Promise.all(
            open.map(async (entry) => ({ id: entry.id, meta: (await bindings.recordOf(workspaceId, entry.id))?.meta ?? {} })),
        )
        const accounts = records.flatMap((record): Array<Account> => {
            const facts = accountFactsOf(record.meta)
            return facts?.connector === this.connector ? [{ connectionId: record.id, facts, meta: record.meta }] : []
        })
        const handed = caller.connectionId
        if (handed !== undefined) {
            const account = accounts.find((one) => one.connectionId === handed)
            if (account === undefined) throw new ToolsError(refusedAs("not_connected"))
            return account
        }
        const agentCall = caller.engine !== true && tool !== null
        if (agentCall && !coversEachAccount(tool)) throw new ToolsError(refusedAs("not_connected"))
        return soleAccountOf(accounts)
    }

    /** The pinned document of the account: the stored text must hash to the pin, and so must the live document when it can be read. */
    private async pinnedOf(account: Account, base: AccountBase, client: Pick<OpenApiClient, "fetchSpec">): Promise<PinnedDocument> {
        const text = pinnedTextOf(account.meta)
        if (text === null) throw new ToolsError(refusedAs("document_unpinned"))
        const cached = this.documents.get(account.connectionId)
        const reading = cached?.text === text ? cached.reading : readDocument(text, account.facts.connector)
        this.documents.set(account.connectionId, { text, reading })
        if (!reading.ok || reading.document.sha256 !== account.facts.documentSha256) {
            throw new ToolsError(refusedAs("document_changed"))
        }
        const live = await this.liveShaOf(account, base, client)
        if (live !== null && live !== account.facts.documentSha256) throw new ToolsError(refusedAs("document_changed"))
        return reading.document
    }

    /** The pin of the live document, looked at once per `LIVE_CHECK_MS`; null when the outside system did not hand a readable one. */
    private async liveShaOf(account: Account, base: AccountBase, client: Pick<OpenApiClient, "fetchSpec">): Promise<string | null> {
        const { connectionId, facts } = account
        const now = this.ports.clock.now().getTime()
        const known = this.lives.get(connectionId)
        if (known !== undefined && now - known.at < LIVE_CHECK_MS) return known.sha
        const fetched = await client.fetchSpec(facts.swaggerUrl === "" ? `${base.baseUrl}${DOCUMENT_PATH}` : facts.swaggerUrl).then(
            (text) => ({ text, cause: null }),
            (cause: unknown) => ({ text: null, cause }),
        )
        const reading = fetched.text === null ? null : readDocument(fetched.text, facts.connector)
        const sha = reading?.ok === true ? reading.document.sha256 : null
        this.lives.set(connectionId, { at: now, sha })
        return sha
    }

    private operationOf(document: PinnedDocument, declaration: OpenApiToolDeclaration): PinnedOperation {
        const operation = document.operations.get(declaration.tool)
        // A call to an operation the connection's pinned snapshot lacks (owner chốt 2026-11-13): refused, never guessed at.
        if (operation === undefined) throw new ToolsError(refusedAs("crm_op_missing"))
        if (operation.unsupported.length > 0) throw new ToolsError(refusedAs("operation_unsupported"))
        if (declaration.reads && operation.method !== "GET") throw new ToolsError(refusedAs("operation_mode_mismatch"))
        return operation
    }

    /** Refuses a base URL the provider may not call: by how it is written, then by the address its host resolves to. */
    private async requireReachable(base: AccountBase): Promise<void> {
        const { host } = this.ports
        const development = host?.allowsPrivate() === true
        if (baseUrlProblemOf(base.baseUrl, development) !== null) throw new ToolsError(refusedAs("host_not_allowed"))
        if (host === undefined) return
        const resolved = await host.resolve(new URL(base.baseUrl).hostname).catch((cause: unknown) => {
            throw new ToolsError(refusedAs("host_not_allowed", cause))
        })
        if (resolvedProblemOf(resolved.address, development) !== null) throw new ToolsError(refusedAs("host_not_allowed"))
    }

    /** The opened key of the account; a key that cannot be opened, or is another workspace's, is a refused connection. */
    private async keyOf(
        workspaceId: string,
        account: Account,
        base: AccountBase,
        secrets: Pick<ConnectionSecretReadsService, "secretOf">,
    ): Promise<AccountKey> {
        const secret = await secrets.secretOf(account.connectionId, OPENAPI_PROVIDER)
        const key =
            secret.kind === "ok" && secret.value.workspaceId === workspaceId ? accountKeyOf(secret.value.credential, base) : null
        if (key === null) throw new ToolsError(refusedAs("connection_refused"))
        return key
    }

    private async send(client: Pick<OpenApiClient, "call">, sending: Sending): Promise<ToolJson> {
        const { operation, request } = sending
        // From here the request is in the client's hands: whatever fails may have reached the outside system.
        const answer = await client
            .call({
            baseUrl: sending.base.baseUrl,
            op: {
                id: operation.operationId,
                method: operation.method,
                path: operation.path,
                summary: "",
                params: request.params,
                hasBody: request.input.body !== undefined,
            },
            auth: { type: sending.key.type, name: sending.key.name, value: sending.key.value, user: "", password: "" },
            input: request.input,
            maxBytes: ANSWER_MAX_BYTES,
            })
            .catch((cause: unknown) => {
                throw withProof(cause, "unknown")
            })
        const outcome = toolOutcomeOf(operation, answer.status, answer.text, request)
        if (outcome.kind === "answer") return outcome.value
        if (outcome.kind === "refused") throw new ToolsError(refusedAs(outcome.reason))
        throw withProof(
            new DataSourcesError({ code: DataSourcesErrorCode.Unavailable, params: { detail: `http_${outcome.status}` } }),
            "unknown",
        )
    }
}
