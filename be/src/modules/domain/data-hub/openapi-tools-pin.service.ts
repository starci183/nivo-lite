import { Injectable } from "@nestjs/common"
import { ConnectionBindingsReadService, type ConnectionActor } from "@modules/domain/connections"
import {
    accountBaseOf,
    accountFactsOf,
    connectorTakenBy,
    installedDeclarationsOf,
    pinOf,
    pinnedReadingOf,
    toolAudiencesOf,
    toolStatesOf,
    undeclaredOperationsOf,
    type PinnedToolAudience,
    type PinnedToolState,
    type UndeclaredOperation,
} from "@modules/domain/openapi-tools"
import { InjectClock, type Clock } from "@modules/platform/clock"
import type { DataConnection } from "./data-hub.contracts"
import { DataHubService } from "./data-hub.service"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"

/** The provider of an API connection. */
const PROVIDER = "openapi"

/** The most accounts of the provider a workspace is read for, when looking for the one that already serves a source. */
const ACCOUNTS_MAX = 20

/** What an owner pins on an API connection so that agents get its declared tools. */
export interface OpenApiToolsPinDraft {
    /** The API connection. */
    readonly connectionId: string
    /** The CRM's provider key the connection serves (`crm.nivoweb`): the CRM id the shop picked, never read from the document. */
    readonly connector: string
    /** Where the document was fetched from (the Swagger URL); empty when it was given as text. */
    readonly swaggerUrl: string
    /** The header parameter that carries the workspace's id. */
    readonly workspaceHeader: string
    /** The OpenAPI document, as JSON text. */
    readonly documentText: string
    /** True to let writes act for real; false keeps every write that can a dry run. */
    readonly live: boolean
}

/** What an API connection serves as tools, as its owner reads it; never the document or a secret. */
export interface OpenApiToolsPinView {
    /** The CRM's provider key it serves (`crm.nivoweb`). */
    readonly connector: string
    /** The Swagger URL the snapshot was fetched from (empty when it was given as text). */
    readonly swaggerUrl: string
    /** The header its workspace id goes in. */
    readonly workspaceHeader: string
    /** Whether writes act for real. */
    readonly live: boolean
    /** The pin: the sha256 of the canonical document. */
    readonly documentSha256: string
    /** When it was pinned, ISO 8601. */
    readonly pinnedAt: string
    /** How each declared tool of the connector stands against the pinned document. */
    readonly tools: ReadonlyArray<PinnedToolState>
    /** How the pinned document opens each declared tool to a run that serves a customer. */
    readonly audiences: ReadonlyArray<PinnedToolAudience>
    /** The operations of the pinned document no installed plugin declares a tool for, by the tool id each would be served under. */
    readonly undeclared: ReadonlyArray<UndeclaredOperation>
}

/** What an API connection serves as tools, or null when it pinned no document. */
export type OptionalOpenApiToolsPinView = OpenApiToolsPinView | null

/** What pinning a draft would come to, with nothing written: the pin as it would read, and whether it differs from the one in force. */
export interface OpenApiToolsPinPlan {
    /** The pin as it reads once written (the one in force when nothing would change). */
    readonly view: OpenApiToolsPinView
    /** False when the account already holds this very pin: the same document, source, header and live switch. */
    readonly changed: boolean
}

/** A draft judged against its connection: the plan, and what to store when it differs. */
interface JudgedPin {
    /** The connection. */
    readonly connection: DataConnection
    /** The public facts to merge into it. */
    readonly meta: Readonly<Record<string, string>>
    /** The plan. */
    readonly plan: OpenApiToolsPinPlan
}

const invalid = (detail: string): DataHubError =>
    new DataHubError({ code: DataHubErrorCode.Invalid, params: { detail } })

@Injectable()
/**
 * Pins a CRM's OpenAPI document on a CRM connection of the workspace (owner or manager), under the CRM id the shop picked: from then on the
 * connection serves every operation of that snapshot (`nivo.api.crm.<crmId>.…`), and only while it stays the pinned one; the view says
 * which operations the installed packages call and whether the snapshot holds each (the compatibility). One open account of a workspace
 * serves a CRM id. Pinning the pin already in force writes nothing. Pinning calls nothing outside (the fetch is the connect service's).
 */
export class OpenApiToolsPinService {
    constructor(
        private readonly hub: DataHubService,
        private readonly bindings: ConnectionBindingsReadService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** What pinning the draft would come to; refused exactly as `pin` refuses, and nothing is written. */
    async plan(actor: ConnectionActor, draft: OpenApiToolsPinDraft): Promise<OpenApiToolsPinPlan> {
        return (await this.judged(actor, draft)).plan
    }

    /**
     * Pins the document; a connection whose key is not sent in a header, a document the provider cannot read or whose source is
     * reserved, declared by no installed plugin, other than the guard or already served by another open account of the workspace, or
     * a document with an id the pin refuses (`PinProblem`), is refused. The pin already in force is left as
     * it is: nothing is written and its own time is answered.
     */
    async pin(actor: ConnectionActor, draft: OpenApiToolsPinDraft): Promise<OpenApiToolsPinView> {
        const { connection, meta, plan } = await this.judged(actor, draft)
        if (!plan.changed) return plan.view
        await this.hub.update(actor.workspaceId, connection.id, {
            name: connection.name,
            meta: { ...connection.meta, ...meta },
            everyMinutes: connection.everyMinutes,
        })
        return plan.view
    }

    /** What the connection serves as tools, or null when it pinned no document (it then serves none). */
    async view(actor: ConnectionActor, connectionId: string): Promise<OptionalOpenApiToolsPinView> {
        await this.hub.ownerOrManager(actor)
        const connection = await this.hub.own(actor.workspaceId, connectionId, PROVIDER)
        const facts = accountFactsOf(connection.meta)
        const document = pinnedReadingOf(connection.meta)
        if (facts === null || document === null) return null
        const declarations = installedDeclarationsOf(facts.connector)
        return {
            connector: facts.connector,
            swaggerUrl: facts.swaggerUrl,
            workspaceHeader: facts.workspaceHeader,
            live: facts.live,
            documentSha256: facts.documentSha256,
            pinnedAt: facts.pinnedAt,
            tools: toolStatesOf(document, declarations),
            audiences: toolAudiencesOf(document, declarations),
            undeclared: undeclaredOperationsOf(document, declarations),
        }
    }

    /** The draft judged for the owner against its connection and the other open accounts of the workspace; nothing is written. */
    private async judged(actor: ConnectionActor, draft: OpenApiToolsPinDraft): Promise<JudgedPin> {
        await this.hub.ownerOrManager(actor)
        const connection = await this.hub.own(actor.workspaceId, draft.connectionId, PROVIDER)
        if (accountBaseOf(connection.meta) === null) throw invalid("key_not_in_header")
        const now = this.clock.now().toISOString()
        const pinning = pinOf(
            { ...draft, pinnedBy: actor.principalId, pinnedAt: now },
            installedDeclarationsOf(draft.connector),
        )
        if (!pinning.ok) throw invalid(pinning.problem)
        const { connector } = pinning
        if (connectorTakenBy(connector, await this.othersOf(actor.workspaceId, connection.id))) {
            throw invalid("connector_taken")
        }
        const held = accountFactsOf(connection.meta)
        const same =
            held !== null &&
            held.connector === connector &&
            held.swaggerUrl === draft.swaggerUrl &&
            held.workspaceHeader === draft.workspaceHeader &&
            held.live === draft.live &&
            held.documentSha256 === pinning.sha256
        const view: OpenApiToolsPinView = {
            connector,
            swaggerUrl: draft.swaggerUrl,
            workspaceHeader: draft.workspaceHeader,
            live: draft.live,
            documentSha256: pinning.sha256,
            pinnedAt: same ? held.pinnedAt : now,
            tools: pinning.tools,
            audiences: pinning.audiences,
            undeclared: pinning.undeclared,
        }
        return { connection, meta: pinning.meta, plan: { view, changed: !same } }
    }

    /** The public facts of every other open account of the provider in the workspace. */
    private async othersOf(
        workspaceId: string,
        connectionId: string,
    ): Promise<ReadonlyArray<Readonly<Record<string, string>>>> {
        const accounts = await this.bindings.ofProvider(workspaceId, PROVIDER, ACCOUNTS_MAX)
        const others = accounts.filter((entry) => entry.id !== connectionId && entry.status !== "disconnected")
        const records = await Promise.all(others.map((entry) => this.bindings.recordOf(workspaceId, entry.id)))
        return records.map((record) => record?.meta ?? {})
    }
}
