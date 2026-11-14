import { Injectable, Optional } from "@nestjs/common"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import {
    OPENAPI_PROVIDER,
    accountKeyOf,
    baseUrlProblemOf,
    resolvedProblemOf,
    type AccountBase,
    type AccountKey,
} from "@modules/domain/openapi-tools"
import type { OpenApiReachAccount, OpenApiReachAnswer, OpenApiReachCall, OpenApiReachPort } from "@modules/domain/openapi-provider"
import { ToolsError, ToolsErrorCode } from "@modules/domain/tools"
import { InjectOpenApi, InjectPublicHost, type OpenApiClient, type PublicHostClient } from "@modules/integrations/data-sources"
import { nativeRefusalParamsOf, type NativeRefusalReason } from "./native-refusal.policy"

/** The connector's refusal of one reason (the same shape `OpenApiConnectorService` throws). */
const refused = (reason: NativeRefusalReason, cause?: unknown): ToolsError =>
    new ToolsError({ code: ToolsErrorCode.NativeRefused, params: nativeRefusalParamsOf(reason), ...(cause === undefined ? {} : { cause }) })

/**
 * The LIVE reach of an API account (the OpenAPI provider's port for a live account): the account's real host, checked by how its base
 * URL is written and by the address it resolves to, its sealed key opened for the client alone, the call through the OpenAPI client
 * and the look at the live document. Exactly what the connector did inline before the reach became a port; the registry reaches it only
 * for a live account. In an app that holds no client or no key store (the MCP endpoint app) every call is refused `not_served`.
 */
export class OpenApiLiveReach implements OpenApiReachPort {
    readonly provider = OPENAPI_PROVIDER

    constructor(
        private readonly secrets?: Pick<ConnectionSecretReadsService, "secretOf">,
        private readonly client?: Pick<OpenApiClient, "call" | "fetchSpec">,
        private readonly host?: Pick<PublicHostClient, "allowsPrivate" | "resolve">,
    ) {}

    /** Whether this app makes outbound calls at all (a client and a key store). */
    serves(): boolean {
        return this.client !== undefined && this.secrets !== undefined
    }

    /** Refuses a base URL the provider may not call: by how it is written, then by the address its host resolves to. */
    async reachable(_account: OpenApiReachAccount, base: AccountBase): Promise<void> {
        const { host } = this
        const development = host?.allowsPrivate() === true
        if (baseUrlProblemOf(base.baseUrl, development) !== null) throw refused("host_not_allowed")
        if (host === undefined) return
        const resolved = await host.resolve(new URL(base.baseUrl).hostname).catch((cause: unknown) => {
            throw refused("host_not_allowed", cause)
        })
        if (resolvedProblemOf(resolved.address, development) !== null) throw refused("host_not_allowed")
    }

    /** The opened key of the account; null for a key that cannot be opened or is another workspace's. */
    async keyOf(account: OpenApiReachAccount, base: AccountBase): Promise<AccountKey | null> {
        if (this.secrets === undefined) throw refused("not_served")
        const secret = await this.secrets.secretOf(account.id, OPENAPI_PROVIDER)
        return secret.kind === "ok" && secret.value.workspaceId === account.workspaceId ? accountKeyOf(secret.value.credential, base) : null
    }

    /** Sends the planned call through the OpenAPI client (the key is written into the request header by the client alone). */
    async call(_account: OpenApiReachAccount, call: OpenApiReachCall): Promise<OpenApiReachAnswer> {
        if (this.client === undefined) throw refused("not_served")
        const key = call.key
        const answer = await this.client.call({
            baseUrl: call.baseUrl,
            op: { id: call.operationId, method: call.method, path: call.path, summary: "", params: call.params, hasBody: call.hasBody },
            auth: { type: key?.type ?? "bearer", name: key?.name ?? "", value: key?.value ?? "", user: "", password: "" },
            input: call.input,
            maxBytes: call.maxBytes,
        })
        return { status: answer.status, text: answer.text }
    }

    /** The live document text at the URL, or null when the outside system did not hand one. */
    async liveDocument(_account: OpenApiReachAccount, url: string): Promise<string | null> {
        if (this.client === undefined) return null
        return this.client.fetchSpec(url).then(
            (text) => text,
            () => null,
        )
    }
}

@Injectable()
/** The live reach as the app composes it: this app's key store, OpenAPI client and host resolver, each absent where the app holds none. */
export class OpenApiLiveReachService extends OpenApiLiveReach {
    constructor(
        @Optional() secrets?: ConnectionSecretReadsService,
        @Optional() @InjectOpenApi() client?: OpenApiClient,
        @Optional() @InjectPublicHost() host?: PublicHostClient,
    ) {
        super(secrets, client, host)
    }
}
