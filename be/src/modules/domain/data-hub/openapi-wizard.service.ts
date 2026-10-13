import { Injectable } from "@nestjs/common"
import type { ConnectionActor } from "@modules/domain/connections"
import {
    DataSourcesError,
    InjectOpenApi,
    InjectPublicHost,
    detectItems,
    getPath,
    isApiJsonObject,
    itemsOf,
    openApiFailure,
    parseJsonBody,
    suggestFromItems,
} from "@modules/integrations/data-sources"
import type { OpenApiAuth, OpenApiClient, PublicHostClient } from "@modules/integrations/data-sources"
import { OPENAPI_WIZARD_TEXT } from "./messages/openapi.messages"
import { DataHubService } from "./data-hub.service"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { cleanAuth, credentialOf, mergeAuth, normalizeConfig, parseAuth, parseConfig, summaryOf } from "./openapi-config.policy"
import type {
    OpenApiConnectionDraft,
    OpenApiConnectionView,
    OpenApiOperationTest,
    OpenApiOperationTestResult,
    OpenApiSpecLoaded,
    OpenApiSpecSource,
} from "./openapi-wizard.contracts"

const SPEC_LIMIT = 5_000_000
const SCHEDULES: ReadonlyArray<number | null> = [null, 15, 60, 360, 1440]

const invalid = (detail: string): DataHubError =>
    new DataHubError({ code: DataHubErrorCode.Invalid, params: { detail } })

const empty = (status: number, error: string): OpenApiOperationTestResult => ({
    status,
    itemCount: 0,
    itemsPath: "",
    idField: "",
    titleField: "",
    sampleKeys: [],
    error,
})

@Injectable()
/** The wizard operations of the owner APIs: read a spec, try an endpoint, load and save the connection. */
export class OpenApiWizardService {
    constructor(
        @InjectOpenApi() private readonly client: OpenApiClient,
        @InjectPublicHost() private readonly publicHost: PublicHostClient,
        private readonly hub: DataHubService,
    ) {}

    /** Reads a spec from a link (https) or pasted text and lists its operations. Saves nothing. */
    async loadSpec(actor: ConnectionActor, source: OpenApiSpecSource): Promise<OpenApiSpecLoaded> {
        await this.hub.owner(actor)
        const specUrl = source.specUrl.trim()
        let text = source.specText
        if (text.trim() === "") {
            if (specUrl === "") throw invalid(OPENAPI_WIZARD_TEXT.noSpecInput)
            text = await this.client.fetchSpec(specUrl)
        } else if (text.length > SPEC_LIMIT) {
            throw invalid(OPENAPI_WIZARD_TEXT.specTooLarge)
        }
        return { ...this.client.parseSpec(text, specUrl), specUrl }
    }

    /** Tries the connection: calls one GET with the typed settings (nothing saved) and reports the status and the items found. */
    async testOperation(actor: ConnectionActor, test: OpenApiOperationTest): Promise<OpenApiOperationTestResult> {
        await this.hub.owner(actor)
        const config = normalizeConfig({ baseUrl: test.baseUrl, ops: [test.op] })
        const op = config.ops[0]
        if (op?.method !== "GET") throw invalid(OPENAPI_WIZARD_TEXT.getOnly)
        const auth = await this.resolveAuth(actor.workspaceId, cleanAuth(test.auth), test.connectionId ?? null)
        const answer = await this.client.call({
            baseUrl: config.baseUrl,
            op,
            auth,
            input: {},
            fixedQuery: test.fixedQuery.replace(/^\?/u, "").slice(0, 500),
        })
        if (answer.status < 200 || answer.status >= 300) return empty(answer.status, openApiFailure(answer.status))
        let body: unknown
        try {
            body = parseJsonBody(answer.text)
        } catch (cause) {
            if (!(cause instanceof DataSourcesError)) throw cause
            return empty(answer.status, String(cause.params.detail ?? ""))
        }
        const typedPath = test.itemsPath.trim()
        const at = typedPath ? getPath(body, typedPath) : undefined
        const found = Array.isArray(at) ? { found: true, path: typedPath, items: at } : detectItems(body)
        const items = found.found ? found.items : itemsOf(body, "")
        const first = items.find(isApiJsonObject)
        return {
            status: answer.status,
            itemCount: items.length,
            itemsPath: found.path,
            ...suggestFromItems(items),
            sampleKeys: first ? Object.keys(first).slice(0, 12) : [],
            error: null,
        }
    }

    /** What the wizard needs to continue editing a connection. Never includes secrets. */
    async load(actor: ConnectionActor, connectionId: string): Promise<OpenApiConnectionView> {
        await this.hub.owner(actor)
        const connection = await this.hub.own(actor.workspaceId, connectionId, "openapi")
        const config = parseConfig(connection.meta.config)
        if (config === null) throw invalid(OPENAPI_WIZARD_TEXT.notConfigured)
        const auth = parseAuth((await this.hub.credentialOf(connection.id)) ?? "")
        return {
            name: connection.name,
            config,
            syncEveryMinutes: connection.everyMinutes,
            hasSecret: Boolean(auth.value || auth.password),
            authUser: auth.user,
        }
    }

    /** Creates the connection (or updates `connectionId`): config in the public facts, auth sealed. Answers its id. */
    async save(actor: ConnectionActor, draft: OpenApiConnectionDraft): Promise<string> {
        await this.hub.owner(actor)
        const syncEvery = draft.syncEveryMinutes ?? null
        const name = draft.name.trim().slice(0, 80)
        if (!name) throw invalid(OPENAPI_WIZARD_TEXT.nameRequired)
        if (!SCHEDULES.includes(syncEvery)) throw invalid(OPENAPI_WIZARD_TEXT.badSchedule)
        const config = normalizeConfig(draft.config)
        if (!/^https?:\/\/[^\s]+$/iu.test(config.baseUrl)) throw invalid(OPENAPI_WIZARD_TEXT.baseUrlScheme)
        await this.publicHost.resolve(new URL(config.baseUrl).hostname)
        if (config.pulls.length === 0 && config.tools.length === 0) {
            throw invalid(OPENAPI_WIZARD_TEXT.pickOne)
        }
        const existing =
            draft.connectionId === null || draft.connectionId === undefined ? null : await this.hub.own(actor.workspaceId, draft.connectionId, "openapi")
        const auth = await this.resolveAuth(actor.workspaceId, cleanAuth(draft.auth), existing?.id ?? null)
        if (config.authType !== "none" && !(auth.value || auth.user || auth.password)) {
            throw invalid(OPENAPI_WIZARD_TEXT.authRequired)
        }
        if ((config.authType === "header" || config.authType === "query") && !config.authName) {
            throw invalid(OPENAPI_WIZARD_TEXT.authNameRequired)
        }
        const credential = credentialOf(config, auth)
        const meta = { config: JSON.stringify(config), summary: summaryOf(config) }
        if (existing !== null) {
            await this.hub.saveCredential(existing.id, credential)
            await this.hub.update(actor.workspaceId, existing.id, { name, meta, everyMinutes: syncEvery })
            return existing.id
        }
        return this.hub.create(actor, {
            provider: "openapi",
            name,
            meta,
            credential,
            everyMinutes: syncEvery,
        })
    }

    /** The auth the owner typed, with blank secrets filled from the stored credential when the type is unchanged. */
    private async resolveAuth(workspaceId: string, typed: OpenApiAuth, connectionId: string | null): Promise<OpenApiAuth> {
        if (connectionId === null) return typed
        const connection = await this.hub.own(workspaceId, connectionId, "openapi")
        return mergeAuth(typed, parseAuth((await this.hub.credentialOf(connection.id)) ?? ""))
    }
}
