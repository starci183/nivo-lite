import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionsService } from "@modules/domain/connections"
import type { ProviderSandboxSwitch } from "./provider-sandbox.contracts"
import { InjectProviderSandboxStore, InjectProviderSandboxSwitch } from "./provider-sandbox.decorators"
import type { ProviderSandboxStore } from "./provider-sandbox-store.port"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "./errors/provider-sandbox.error"

/** The header a webhook call for a sandbox account carries its key in (ruling R58). */
export const SANDBOX_KEY_HEADER = "x-nivo-sandbox-key"

/** A connection id is a uuid; any other scope (an app-level route) names no account and is live by definition. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** What the guard concluded for one webhook call: the account is live (its provider's own proof runs, untouched) or a proven sandbox one. */
export type SandboxWebhookVerdict = { readonly kind: "live" } | { readonly kind: "sandbox"; readonly workspaceId: string; readonly provider: string }

@Injectable()
/**
 * THE ONE SHARED GUARD of a provider webhook for a sandbox account (ruling R58: a sandbox account keeps the provider's OWN webhook route;
 * only its verification differs). Every provider webhook door asks it first, with the connection id its route names and the
 * `x-nivo-sandbox-key` header: a LIVE, removed or unknown account answers `live` and the door runs its provider's own signature proof
 * exactly as before (never weakened; a sandbox key means nothing there); a SANDBOX account must present its derived sandbox key while the
 * sandbox is switched on (R60), else the call is refused `PROVIDER_SANDBOX_WEBHOOK_KEY_REFUSED` / `PROVIDER_SANDBOX_OFF`; on a match the door
 * skips the provider proof (the account holds no provider secret) and goes on through its same intake, translate and deliver.
 */
export class SandboxWebhookKeyService {
    constructor(
        @InjectProviderSandboxStore() private readonly store: ProviderSandboxStore,
        @InjectProviderSandboxSwitch() private readonly switched: ProviderSandboxSwitch,
        private readonly connections: ConnectionsService,
    ) {}

    /** The verdict of one webhook call for the connection its route names (any workspace: the route names the account alone). */
    async verdictOf(connectionId: string, presented: string | undefined, manager?: EntityManager): Promise<SandboxWebhookVerdict> {
        if (!UUID.test(connectionId)) return { kind: "live" }
        const account = await this.store.accountOfId(connectionId, manager)
        if (account?.sandbox !== true) return { kind: "live" }
        if (!this.switched.enabled) throw new ProviderSandboxError({ code: ProviderSandboxErrorCode.Off })
        if (!this.connections.isSandboxKey(account.id, presented)) {
            throw new ProviderSandboxError({ code: ProviderSandboxErrorCode.WebhookKeyRefused, params: { connectionId } })
        }
        return { kind: "sandbox", workspaceId: account.workspaceId, provider: account.provider }
    }
}
