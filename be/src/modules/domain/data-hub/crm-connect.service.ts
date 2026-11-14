import { Injectable } from "@nestjs/common"
import { crmIdOfProviderKey, crmProviderKeyOf, isCrmId } from "@nivo-lite/agent-sdk/names"
import type { ConnectionActor } from "@modules/domain/connections"
import {
    CRM_TEMPLATES,
    DOCUMENT_MAX_CHARS,
    OPENAPI_PROVIDER,
    accountBaseOf,
    accountFactsOf,
    baseUrlProblemOf,
    crmTemplateOf,
    crmTemplateOpenTo,
    installedDeclarationsOf,
    readDocument,
} from "@modules/domain/openapi-tools"
import {
    DataSourcesError,
    InjectOpenApi,
    InjectPublicHost,
    type OpenApiClient,
    type PublicHostClient,
} from "@modules/integrations/data-sources"
import { WorkspaceEnterpriseService } from "@modules/domain/workspaces"
import type { DataConnection } from "./data-hub.contracts"
import { DataHubService } from "./data-hub.service"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { credentialOf, mergeAuth, normalizeConfig, parseAuth, parseConfig } from "./openapi-config.policy"
import { OpenApiToolsPinService, type OpenApiToolsPinView } from "./openapi-tools-pin.service"

/** The header a workspace id goes in on every call of a CRM connection. */
const WORKSPACE_HEADER = "X-Workspace-Id"

/** The longest connection name kept. */
const NAME_MAX = 80

/** How a CRM's key is sent, as the shop (or the template) gives it. */
export type CrmAuthDraft = { readonly type: "bearer"; readonly value: string } | { readonly type: "header"; readonly name: string; readonly value: string }

/**
 * What a shop saves to connect a CRM provider via OpenAPI (owner decided 2026-11-13 / 2026-11-14). A CRM a package declares
 * (`defineProviderTemplate`) is picked by its id: the template gives the auth type and where the live document is (`swaggerPath`), so the
 * shop enters only the API base URL and the secret. A CRM no package supports ("CRM khac") gives its own id, its Swagger URL and its auth.
 */
export interface CrmConnectionDraft {
    /** The connection to update; null or absent creates one. */
    readonly connectionId?: string | null | undefined
    /** The CRM id: a template's (`nivoweb`) or the shop's own (2 to 31 characters, `[a-z][a-z0-9-]*`). */
    readonly crmId: string
    /** The API base URL (https; http only on a development site). */
    readonly baseUrl: string
    /** Only for a CRM no package declares: where its OpenAPI document is. Ignored for a template's CRM. */
    readonly swaggerUrl?: string | null | undefined
    /** The key: a blank value keeps the stored one on an update. For a template's CRM its type must be the template's. */
    readonly auth: CrmAuthDraft
}

/** One operation the installed packages call on the CRM, and whether the live document serves it callable. */
export interface CrmNeededOperation {
    /** Its ONE name (`nivo.api.crm.nivoweb.get.prices`). */
    readonly op: string
    /** `ready`, or why not (`missing`: the live document has no such operation; `unsupported`; `mode_mismatch`). */
    readonly state: "ready" | "missing" | "unsupported" | "mode_mismatch"
}

/** What saving a CRM connection came to: its id, the pin of the LIVE document, and its compatibility. */
export interface CrmConnectionResult {
    /** The connection. */
    readonly connectionId: string
    /** The pin as it now reads (every operation of the snapshot is callable by its name; the view says which the packages need). */
    readonly pin: OpenApiToolsPinView
    /** True when a package declares this CRM (a template); false for a shop's own CRM. */
    readonly templated: boolean
    /** The operations of the package's pinned document the live document lacks (a template's CRM only): the CRM moved away from it. */
    readonly driftFromTemplate: ReadonlyArray<string>
    /** True when every operation the installed packages call is `ready`: nothing blocks their nodes. */
    readonly compatible: boolean
}

/** A name in both languages. */
interface CrmLabel {
    readonly vi: string
    readonly en: string
}

/** A CRM template as the connect wizard lists it (never the pinned document itself). */
export interface CrmTemplateView {
    /** The fixed CRM id. */
    readonly id: string
    /** Its name in both languages. */
    readonly label: CrmLabel
    /** How the key is sent. */
    readonly authType: "bearer" | "header"
    /** The header the key goes in (`header` only), else empty. */
    readonly authName: string
    /** Where the live document is served under the base URL. */
    readonly swaggerPath: string
    /** An example base URL. */
    readonly baseUrlHint: string
    /** A documentation link, or empty. */
    readonly docs: string
    /** How many operations the installed packages call on it. */
    readonly neededCount: number
}

/** A saved CRM connection as the provider page reopens it; never holds the key. */
export interface CrmConnectionView {
    /** The CRM id (`nivoweb`). */
    readonly crmId: string
    /** The API base URL, or empty when the connection has none readable. */
    readonly baseUrl: string
    /** The Swagger URL the snapshot was fetched from (empty when none). */
    readonly swaggerUrl: string
    /** How the key is sent: `bearer`, `header`, or empty when unreadable. */
    readonly authType: string
    /** The header the key goes in (`header` only), else empty. */
    readonly authName: string
    /** True when a key is stored (its value is never answered). */
    readonly hasSecret: boolean
    /** The pin as it reads now, or null when the connection pinned no document. */
    readonly pin: OpenApiToolsPinView | null
}

const invalid = (detail: string, cause?: unknown): DataHubError =>
    new DataHubError({ code: DataHubErrorCode.Invalid, params: { detail }, cause })

/** A base URL without the slashes it ends with. */
const withoutTrailingSlashes = (url: string): string => {
    let end = url.length
    while (end > 0 && url[end - 1] === "/") end -= 1
    return url.slice(0, end)
}

@Injectable()
/**
 * Connects a CRM provider via OpenAPI (owner or manager): the engine fetches the LIVE document (https, every redirect hop's address checked
 * public, a size and a time cap: the public host client), reads it for the CRM id, pins it on the connection as that connection's own
 * snapshot, and checks it against what the installed packages call on that CRM (and, for a template's CRM, against the package's pinned
 * document). Nothing is trusted without the live fetch: every save, a re-pin included, fetches again. A missing operation is no refusal:
 * the connection is saved and the nodes that need it are blocked by readiness (`tool_unavailable`); a call to an operation the snapshot
 * lacks is refused `crm_op_missing`. The key is sealed and never answered.
 */
export class CrmConnectService {
    constructor(
        private readonly hub: DataHubService,
        private readonly pins: OpenApiToolsPinService,
        @InjectOpenApi() private readonly client: OpenApiClient,
        @InjectPublicHost() private readonly publicHost: PublicHostClient,
        private readonly enterprise: WorkspaceEnterpriseService,
    ) {}

    /**
     * The CRMs the installed packages declare that are open to the workspace (a private plugin's template only to its enterprises), for
     * the connect wizard.
     */
    async templates(workspaceId: string): Promise<ReadonlyArray<CrmTemplateView>> {
        const enterpriseKey = await this.enterprise.keyOf(workspaceId)
        return CRM_TEMPLATES.filter((template) => crmTemplateOpenTo(template.id, enterpriseKey)).map((template) => ({
            id: template.id,
            label: template.label,
            authType: template.auth.type,
            authName: template.auth.type === "header" ? template.auth.name : "",
            swaggerPath: template.swaggerPath,
            baseUrlHint: template.baseUrlHint,
            docs: template.docs ?? "",
            neededCount: installedDeclarationsOf(crmProviderKeyOf(template.id)).length,
        }))
    }

    /** The saved connection for the provider page (owner or manager): its configuration without the key, and its pin. */
    async connection(actor: ConnectionActor, connectionId: string): Promise<CrmConnectionView> {
        await this.hub.ownerOrManager(actor)
        const connection = await this.hub.own(actor.workspaceId, connectionId, OPENAPI_PROVIDER)
        const pin = await this.pins.view(actor, connectionId)
        const base = accountBaseOf(connection.meta)
        const secret = parseAuth((await this.hub.credentialOf(connection.id)) ?? "")
        const crmId = pin === null ? (connection.meta.summary ?? "") : crmIdOfProviderKey(pin.connector)
        return {
            crmId: crmId ?? "",
            baseUrl: base?.baseUrl ?? "",
            swaggerUrl: pin?.swaggerUrl ?? parseConfig(connection.meta.config)?.specUrl ?? "",
            authType: base?.authType ?? "",
            authName: base?.authName ?? "",
            hasSecret: secret.value !== "",
            pin,
        }
    }

    /** Saves the connection, fetches and pins the live document, and answers the compatibility. */
    async save(actor: ConnectionActor, draft: CrmConnectionDraft): Promise<CrmConnectionResult> {
        await this.hub.ownerOrManager(actor)
        const crmId = draft.crmId.trim()
        if (!isCrmId(crmId)) throw invalid("crm_id_invalid")
        const providerKey = crmProviderKeyOf(crmId)
        const template = crmTemplateOf(providerKey)
        // A template's id is that package's alone: a workspace its plugin is closed to may not take it, not even as "CRM khac".
        if (template !== null && !crmTemplateOpenTo(template.id, await this.enterprise.keyOf(actor.workspaceId))) {
            throw invalid("crm_id_invalid")
        }
        const baseUrl = withoutTrailingSlashes(draft.baseUrl.trim())
        await this.requirePublic(baseUrl)
        const swaggerUrl = template === null ? (draft.swaggerUrl ?? "").trim() : `${baseUrl}${template.swaggerPath}`
        if (swaggerUrl === "") throw invalid("swagger_url_required")
        await this.requirePublic(swaggerUrl)
        if (template !== null && template.auth.type !== draft.auth.type) throw invalid("auth_type_mismatch")
        const authName = draft.auth.type === "header" ? draft.auth.name.trim() : ""
        const existing = await this.existingOf(actor, draft)
        const typed = { type: draft.auth.type, name: authName, value: draft.auth.value, user: "", password: "" }
        const stored = existing === null ? null : parseAuth((await this.hub.credentialOf(existing.id)) ?? "")
        const auth = mergeAuth(typed, stored)
        if (auth.value === "") throw invalid("auth_required")
        const config = normalizeConfig({ specUrl: swaggerUrl, baseUrl, authType: draft.auth.type, authName })
        const live = await this.liveDocumentOf(swaggerUrl)
        const reading = readDocument(live, providerKey)
        if (!reading.ok) throw invalid(reading.problem)
        const meta = { config: JSON.stringify(config), summary: crmId }
        const credential = credentialOf(config, auth)
        let connectionId: string
        if (existing === null) {
            connectionId = await this.hub.create(actor, { provider: OPENAPI_PROVIDER, name: this.nameOf(template?.label.vi ?? crmId), meta, credential, everyMinutes: null })
        } else {
            await this.hub.saveCredential(existing.id, credential)
            await this.hub.update(actor.workspaceId, existing.id, { name: existing.name, meta: { ...existing.meta, ...meta }, everyMinutes: existing.everyMinutes })
            connectionId = existing.id
        }
        const pin = await this.pins.pin(actor, {
            connectionId,
            connector: providerKey,
            swaggerUrl,
            workspaceHeader: WORKSPACE_HEADER,
            documentText: live,
            // Real writes stay a person's switch: a new connection starts as a dry run, an update keeps what was set.
            live: existing !== null && accountFactsOf(existing.meta)?.live === true,
        })
        const driftFromTemplate = template === null ? [] : this.driftOf(template.openapi, providerKey, reading.document.operations)
        return {
            connectionId,
            pin,
            templated: template !== null,
            driftFromTemplate,
            compatible: pin.tools.every((tool) => tool.state === "ready"),
        }
    }

    /** The connection a save updates, or null when the save makes a new one. */
    private existingOf(actor: ConnectionActor, draft: CrmConnectionDraft): Promise<DataConnection | null> {
        if (draft.connectionId === null || draft.connectionId === undefined) return Promise.resolve(null)
        return this.hub.own(actor.workspaceId, draft.connectionId, OPENAPI_PROVIDER)
    }

    /** The operations of a template's pinned document the live document does not serve: what the package expects and the CRM lost. */
    private driftOf(pinned: unknown, providerKey: string, live: ReadonlyMap<string, unknown>): ReadonlyArray<string> {
        const reading = readDocument(JSON.stringify(pinned), providerKey)
        if (!reading.ok) return []
        return [...reading.document.operations.keys()].filter((op) => !live.has(op))
    }

    /** The connection's name: the template's label, or the CRM id. */
    private nameOf(label: string): string {
        return `CRM ${label}`.slice(0, NAME_MAX)
    }

    /** Refuses an address the engine may not fetch or call: by how it is written, then by the address its host resolves to. */
    private async requirePublic(url: string): Promise<void> {
        const problem = baseUrlProblemOf(url, this.publicHost.allowsPrivate())
        if (problem !== null) throw invalid(problem)
        await this.publicHost.resolve(new URL(url).hostname).catch((cause: unknown) => {
            if (cause instanceof DataSourcesError) throw invalid("private_host", cause)
            throw cause
        })
    }

    /** The live document's text (the public host client: redirects re-checked, 5 MB and a time cap), refused when it is too large to pin. */
    private async liveDocumentOf(swaggerUrl: string): Promise<string> {
        const text = await this.client.fetchSpec(swaggerUrl).catch((cause: unknown) => {
            if (cause instanceof DataSourcesError) throw invalid("swagger_unreachable", cause)
            throw cause
        })
        if (text.length > DOCUMENT_MAX_CHARS) throw invalid("too_large")
        return text
    }
}
