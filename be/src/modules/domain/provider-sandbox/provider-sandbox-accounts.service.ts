import { Injectable } from "@nestjs/common"
import { ConnectionsService, isProvider, type ConnectionActor, type ConnectionRecord } from "@modules/domain/connections"
import { InjectClock, type Clock } from "@modules/platform/clock"
import type {
    SandboxAccount,
    SandboxCall,
    SandboxCase,
    SandboxInput,
    SandboxInputField,
    SandboxLatestRequest,
} from "./provider-sandbox.contracts"
import { InjectSandboxWebhookPoster } from "./provider-sandbox.decorators"
import { ProviderSandboxService } from "./provider-sandbox.service"
import { SANDBOX_KEY_HEADER } from "./sandbox-webhook-key.service"
import { SandboxCatalogueRegistryService } from "./sandbox-catalogue-registry.service"
import type { SandboxWebhookPoster } from "./sandbox-webhook-poster.port"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "./errors/provider-sandbox.error"

/** A sandbox account just opened: its id and its sandbox key (derived, readable again by an owner or manager). */
export interface OpenedSandbox {
    readonly id: string
    readonly sandboxKey: string
}

/** One webhook call an inbound case made and what NIVO's own route answered it (its HTTP status and body). */
export interface SandboxDelivery {
    readonly path: string
    readonly status: number
    readonly body: unknown
}

/** What sending one inbound case did: the case, the inputs it was built from, and each webhook call in order. */
export interface SandboxSendResult {
    readonly caseId: string
    readonly input: SandboxInput
    readonly deliveries: ReadonlyArray<SandboxDelivery>
}

/** The account's next case of one outbound operation: the picked case, or the default (success) case when nothing is picked. */
export interface SandboxNextCase {
    readonly operation: string
    readonly caseId: string
    /** True when nothing is picked and the default case answers. */
    readonly isDefault: boolean
}

/** The roles that may use the sandbox doors. */
const MANAGERS = ["owner", "manager"] as const

/** The inputs of a send: each declared field from what was given, else the prefill, else the field's example; checked by kind. */
const inputOf = (fields: ReadonlyArray<SandboxInputField>, given: SandboxInput, prefilled: SandboxInput): SandboxInput =>
    Object.fromEntries(
        fields.map((field) => {
            const value = given[field.name] ?? prefilled[field.name] ?? field.example
            const fits = field.kind === "integer" ? typeof value === "number" && Number.isSafeInteger(value) : typeof value === "string"
            if (!fits) throw new ProviderSandboxError({ code: ProviderSandboxErrorCode.InputInvalid, params: { field: field.name } })
            return [field.name, value]
        }),
    )

@Injectable()
/**
 * What the Sandbox page and a test reach through the app's API (owner or manager only; rulings R58, R60, R62): whether the sandbox is
 * on, open a sandbox account of a provider (no credential, no secret), list the workspace's sandbox accounts, a provider's hardcoded
 * catalogue, an account's call log and reset, its sandbox key, the latest request the agent made of it (R62 prefill), its next case of
 * each outbound operation (R62 selector, sticky until changed) and THE ONE SEND of an inbound case to the provider's own webhook route.
 */
export class ProviderSandboxAccountsService {
    constructor(
        private readonly connections: ConnectionsService,
        private readonly sandbox: ProviderSandboxService,
        private readonly catalogues: SandboxCatalogueRegistryService,
        @InjectSandboxWebhookPoster() private readonly poster: SandboxWebhookPoster,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Whether the sandbox is on in this environment (the fe hides the page when it is not). */
    enabled(): boolean {
        return this.sandbox.enabled()
    }

    /**
     * Opens a sandbox account of a provider that ships a sandbox: connected, live environment, NO credential and no secret row; the flag
     * never changes. A provider with no catalogue is refused `PROVIDER_SANDBOX_PROVIDER_UNKNOWN`.
     */
    async open(actor: ConnectionActor, input: { readonly provider: string; readonly name: string }): Promise<OpenedSandbox> {
        this.on()
        await this.connections.authorize(actor, MANAGERS)
        const { provider } = input
        // Only a provider that ships a sandbox (its catalogue registered) opens one: anything else could never answer a call.
        if (!isProvider(provider) || !this.catalogues.providers().includes(provider)) {
            throw new ProviderSandboxError({ code: ProviderSandboxErrorCode.ProviderUnknown, params: { provider } })
        }
        const id = await this.connections.create({
            workspaceId: actor.workspaceId,
            createdBy: actor.principalId,
            provider,
            name: input.name,
            status: "connected",
            environment: "live",
            meta: {},
            sandbox: true,
        })
        return { id, sandboxKey: await this.keyOf(actor.workspaceId, id) }
    }

    /**
     * Refuses unless the sandbox is on and the actor is an owner or manager of the workspace: the gate of every Sandbox page door that is
     * not about one account (the parked runs and "expire this run's wait now", R62/R66, which the API composes with the engine).
     */
    async assertManager(actor: ConnectionActor): Promise<void> {
        this.on()
        await this.connections.authorize(actor, MANAGERS)
    }

    /**
     * One sandbox account of the actor's workspace, as the doors see it (owner or manager): refused `PROVIDER_SANDBOX_OFF` when the sandbox
     * is off, `PROVIDER_SANDBOX_ACCOUNT_NOT_FOUND` when unknown or removed, `PROVIDER_SANDBOX_LIVE_ACCOUNT` when it is a live account.
     */
    account(actor: ConnectionActor, connectionId: string): Promise<SandboxAccount> {
        return this.accountOf(actor, connectionId)
    }

    /**
     * Removes a sandbox account that was just opened and could not be given what it was opened for (the take-back of an open that
     * failed half way); same refusals as {@link account}.
     */
    async discard(actor: ConnectionActor, connectionId: string): Promise<void> {
        const account = await this.accountOf(actor, connectionId)
        await this.connections.remove(account.workspaceId, account.id)
    }

    /** The workspace's sandbox accounts, oldest first. */
    async accounts(actor: ConnectionActor): Promise<ReadonlyArray<ConnectionRecord>> {
        this.on()
        await this.connections.authorize(actor, MANAGERS)
        return (await this.connections.list(actor.workspaceId)).filter((connection) => connection.sandbox)
    }

    /** The providers that ship a sandbox catalogue (what the page offers to open). */
    async providers(actor: ConnectionActor): Promise<ReadonlyArray<string>> {
        this.on()
        await this.connections.authorize(actor, MANAGERS)
        return this.catalogues.providers()
    }

    /** A provider's hardcoded cases. */
    async catalogue(actor: ConnectionActor, provider: string): Promise<ReadonlyArray<SandboxCase>> {
        this.on()
        await this.connections.authorize(actor, MANAGERS)
        return this.catalogues.casesOf(provider)
    }

    /** The account's call log, oldest first; of one operation when it is named. */
    async calls(actor: ConnectionActor, connectionId: string, operation?: string): Promise<ReadonlyArray<SandboxCall>> {
        return this.sandbox.calls(await this.accountOf(actor, connectionId), operation)
    }

    /** Forgets the account's state, next cases and call log. */
    async reset(actor: ConnectionActor, connectionId: string): Promise<void> {
        await this.sandbox.reset(await this.accountOf(actor, connectionId))
    }

    /** The account's sandbox key, for a test caller of its webhook. */
    async sandboxKey(actor: ConnectionActor, connectionId: string): Promise<string> {
        const account = await this.accountOf(actor, connectionId)
        return this.keyOf(account.workspaceId, account.id)
    }

    /**
     * THE ONE SEND of an inbound case (R62): account -> its provider's catalogue case -> the case's transformation of the inputs into the
     * provider's webhook payload(s) (logged on the account as one `inbound` call) -> each POSTed, in order, to the provider's OWN route on
     * NIVO with the account's sandbox key, through this api's own listener (`SandboxWebhookPoster`). Inputs not given are prefilled from
     * the account's latest request (R62 "latest payment request"), else the case's examples; an input of the wrong kind is refused. A
     * route's refusal is answered in its delivery (status and body), not thrown, so the page shows what NIVO did.
     */
    async send(actor: ConnectionActor, connectionId: string, caseId: string, given: SandboxInput = {}): Promise<SandboxSendResult> {
        const account = await this.accountOf(actor, connectionId)
        const inbound = this.catalogues.caseOf(account.provider, caseId)?.inbound
        if (inbound === undefined) throw new ProviderSandboxError({ code: ProviderSandboxErrorCode.CaseUnknown, params: { caseId } })
        const prefilled = (await this.latestOf(account))?.input ?? {}
        const input = inputOf(inbound.inputs, given, prefilled)
        const events = await this.sandbox.inbound(account, caseId, inbound, input, this.clock.now())
        const key = await this.keyOf(account.workspaceId, account.id)
        const path = inbound.path(account.id)
        const deliveries: Array<SandboxDelivery> = []
        for (const event of events) {
            // One after the other: a duplicate delivery reaches the route after the first one, as the provider's retry does.
            // eslint-disable-next-line no-await-in-loop
            const reply = await this.poster.post({ path, body: event.body, headers: { ...event.headers, [SANDBOX_KEY_HEADER]: key } })
            deliveries.push({ path, status: reply.status, body: reply.body })
        }
        return { caseId, input, deliveries }
    }

    /** The request the agent last made of the account (a payment instruction), read as inputs; null when it made none. */
    async latestRequest(actor: ConnectionActor, connectionId: string): Promise<SandboxLatestRequest | null> {
        return this.latestOf(await this.accountOf(actor, connectionId))
    }

    /** The account's next case of every outbound operation of its provider (the picked one, else the default success case). */
    async nextCases(actor: ConnectionActor, connectionId: string): Promise<ReadonlyArray<SandboxNextCase>> {
        const account = await this.accountOf(actor, connectionId)
        const outbound = this.outboundOf(account.provider)
        const operations = [...new Set(outbound.flatMap((one) => (one.operation === undefined ? [] : [one.operation])))]
        const found: Array<SandboxNextCase> = []
        for (const operation of operations) {
            // eslint-disable-next-line no-await-in-loop
            const picked = await this.sandbox.nextCaseOf(account, operation)
            const caseId = picked ?? outbound.find((one) => one.operation === operation && one.default === true)?.id
            if (caseId !== undefined) found.push({ operation, caseId, isDefault: picked === null })
        }
        return found
    }

    /** Picks the account's next case of that case's own operation (sticky until changed; picking the default case goes back to success). */
    async setNextCase(actor: ConnectionActor, connectionId: string, caseId: string): Promise<SandboxNextCase> {
        const account = await this.accountOf(actor, connectionId)
        const picked = this.outboundOf(account.provider).find((one) => one.id === caseId)
        if (picked?.operation === undefined) throw new ProviderSandboxError({ code: ProviderSandboxErrorCode.CaseUnknown, params: { caseId } })
        await this.sandbox.setNextCase(account, picked.operation, caseId)
        return { operation: picked.operation, caseId, isDefault: false }
    }

    /** A sandbox account of the actor's workspace (owner or manager), refused when the sandbox is off, unknown, removed or live. */
    private async accountOf(actor: ConnectionActor, connectionId: string): Promise<SandboxAccount> {
        this.on()
        await this.connections.authorize(actor, MANAGERS)
        const found = await this.connections.find(actor.workspaceId, connectionId)
        if (found === null) throw new ProviderSandboxError({ code: ProviderSandboxErrorCode.AccountNotFound, params: { connectionId } })
        this.sandbox.assertOpen(found)
        return found
    }

    /** The outbound cases of a provider (they answer an operation and are no inbound event). */
    private outboundOf(provider: string): ReadonlyArray<SandboxCase> {
        return this.catalogues.casesOf(provider).filter((one) => one.operation !== undefined && one.inbound === undefined)
    }

    /** The newest answered call of the provider's prefill operation, read as inputs. */
    private async latestOf(account: SandboxAccount): Promise<SandboxLatestRequest | null> {
        const prefill = this.catalogues.prefillOf(account.provider)
        if (prefill === null) return null
        const calls = await this.sandbox.calls(account, prefill.operation)
        for (const call of [...calls].reverse()) {
            const input = call.result.outcome === "answered" ? prefill.inputOf(call.request) : null
            if (input !== null) return { operation: prefill.operation, input, at: call.at }
        }
        return null
    }

    private async keyOf(workspaceId: string, connectionId: string): Promise<string> {
        const key = await this.connections.sandboxKeyOf(workspaceId, connectionId)
        if (key === null) throw new ProviderSandboxError({ code: ProviderSandboxErrorCode.LiveAccount, params: { connectionId } })
        return key
    }

    private on(): void {
        if (!this.sandbox.enabled()) throw new ProviderSandboxError({ code: ProviderSandboxErrorCode.Off })
    }
}
