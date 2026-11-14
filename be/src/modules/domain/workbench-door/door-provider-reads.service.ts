import { Injectable, Optional } from "@nestjs/common"
import { API_CARRIER } from "@nivo-lite/agent-sdk/names"
import type { EntityManager } from "typeorm"
import { AccountDataIntakeService, AccountDataReadService } from "@modules/domain/account-data"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { parsePayload } from "./door-payload.policy"
import { WorkbenchDoorError, WorkbenchDoorErrorCode } from "./errors/workbench-door.error"
import { INTERFACE_SNAPSHOT_TYPE } from "./interface.data-types"
import {
    type InterfaceCall,
    type InterfaceProviderAnswer,
    type InterfaceReadSchema,
    type InterfaceReadProvider,
    type InterfaceViewer,
    type OptionalStoredDoorAnswer,
    type ProviderReadName,
    type ProviderRegistryReads,
} from "./provider-reads.contracts"
import {
    interfaceCallOf,
    isKeptAnswer,
    isStoredProviderAnswer,
    providerReadPayloadOf,
    snapshotKeyOf,
    snapshotVerbOf,
} from "./provider-read-store.policy"
import { mayReadProvider, providerReadNameOf, rowCountOf } from "./provider-reads.policy"
import { CORE_API_READS, apiVerbOfRead } from "./provider-reads.registry"
import type { DoorAnswer, DoorCall } from "./workbench-door.contracts"
import { InjectInterfaceReadProviders, InjectProviderRegistryReads } from "./workbench-door.decorators"
import { WorkbenchDoorLogEvent } from "./workbench-door.log-events"

@Injectable()
/**
 * The door of the reads providers registered for screens. The caller is a member the door already proved; this service finds the
 * provider and the read the call names (`<provider>:<read>`), asks the permission seam, hands the input to the provider's own
 * executor and writes one audit line per read: who, which provider and read, what it came to and how many rows, never content. It
 * holds no agent identity: a person's read is no tool call and appears in no agent audit. A named read of one account (its payload
 * names a `connectionId`) is answered from the account's stored answer (`interface.snapshot`, served for a minute: `source: "synced"`)
 * when that account is one of the caller's workspace, unless the payload asks `fresh: true`; a live answer of the provider is stored for
 * the next read.
 */
export class DoorProviderReadsService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @Optional() @InjectInterfaceReadProviders() private readonly providers?: ReadonlyArray<InterfaceReadProvider>,
        @Optional() @InjectClock() private readonly clock?: Clock,
        @Optional() @InjectProviderRegistryReads() private readonly registry?: ProviderRegistryReads,
        @Optional() private readonly reads?: AccountDataReadService,
        @Optional() private readonly intake?: AccountDataIntakeService,
        @Optional() private readonly bindings?: ConnectionBindingsReadService,
        @Optional() @InjectPrimaryEntityManager() private readonly entityManager?: EntityManager,
    ) {}

    /** Runs a provider read for a proven member and answers it as JSON text; an unknown provider or read is `READ_UNKNOWN`. */
    async read(memberId: string, call: DoorCall): Promise<DoorAnswer> {
        const name = providerReadNameOf(call.name)
        if (name === null) throw this.unknown(call.name)
        // A core provider's read is served only through the level-1 registry, total over `API`; the carrier's other reads are its sources'.
        const core = apiVerbOfRead(name)
        const kind = core === null ? null : CORE_API_READS[core].read
        if (core === null && name.provider !== API_CARRIER) throw this.unknown(call.name)
        if ((kind === "config" || kind === "rights") && this.registry !== undefined) {
            return this.registryRead(this.registry, memberId, call, name)
        }
        const provider = (this.providers ?? []).find((entry) => entry.provider === name.provider)
        const viewer = { workspaceId: call.workspaceId, memberId }
        if (provider === undefined) throw this.unknown(call.name)
        if (!mayReadProvider(viewer, name)) {
            throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.PermissionDenied, params: { permission: call.name } })
        }
        const parsed = parsePayload(call.payload)
        if (!parsed.ok) throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.PayloadInvalid, params: { issues: "." } })
        const audit = { workspaceId: call.workspaceId, memberId, provider: name.provider, read: name.read }
        if (kind === "info") return this.info(provider, call, parsed.value.connectionId, audit)
        const offered = await provider.readsOf(call.workspaceId)
        if (!offered.some((read) => read.name === name.read)) throw this.unknown(call.name)
        return this.named(provider, viewer, name, parsed.value, audit)
    }

    /**
     * A named read the provider offers: from the account's stored answer while it is usable (unless the payload asks `fresh`), else from
     * the provider, whose answer of a page or a record is then stored for the account.
     */
    private async named(
        provider: InterfaceReadProvider,
        viewer: InterfaceViewer,
        name: ProviderReadName,
        value: InterfaceReadSchema,
        audit: Readonly<Record<string, string>>,
    ): Promise<DoorAnswer> {
        const payload = providerReadPayloadOf(value)
        const account = payload.connectionId
        const asked = interfaceCallOf(snapshotVerbOf(name), payload.input)
        if (account !== null && !payload.fresh) {
            const stored = await this.storedAnswer(viewer, account, asked, audit)
            if (stored !== null) return stored
        }
        const started = this.nowMs()
        const answer = await provider.read(viewer, name.read, payload.input).catch((cause: unknown) => {
            this.logger.info(WorkbenchDoorLogEvent.ProviderRead, { ...audit, outcome: "failed", rows: 0 })
            throw cause
        })
        this.logger.info(WorkbenchDoorLogEvent.ProviderRead, { ...audit, outcome: answer.kind, rows: rowCountOf(answer) })
        if (account !== null && isKeptAnswer(answer)) {
            await this.keep(viewer, account, asked, answer, this.nowMs() - started, audit)
        }
        // Freshness of a named read: the provider's own (`live` unless it says its reads come from its store), as of this call.
        const asOf = this.clock?.now().toISOString() ?? null
        return { data: JSON.stringify({ ...answer, source: provider.freshness === "synced" ? "synced" : "live", asOf }) }
    }

    /**
     * The account's stored answer of the read while it is usable (the store drops it after its minute), answered as a live one but
     * `synced` as of the provider's last call, with its audit line. Null when there is none, when the account is not one of the caller's
     * workspace (a connection id of another workspace never reads that workspace's answer), or when the store cannot be read: the
     * provider is asked, the read never fails on it.
     */
    private async storedAnswer(
        viewer: InterfaceViewer,
        connectionId: string,
        asked: InterfaceCall,
        audit: Readonly<Record<string, string>>,
    ): Promise<OptionalStoredDoorAnswer> {
        const reads = this.reads
        if (reads === undefined) return null
        const stored = await this.ofCallerWorkspace(viewer, connectionId)
            .then((mine) => (mine ? reads.get(connectionId, INTERFACE_SNAPSHOT_TYPE, snapshotKeyOf(asked)) : null))
            .catch((cause: unknown) => {
                this.logger.error(WorkbenchDoorLogEvent.ProviderRead, cause, { ...audit, outcome: "store_unreadable" })
                return null
            })
        if (stored === null) return null
        const answer = stored.value.answer
        if (!isStoredProviderAnswer(answer)) return null
        this.logger.info(WorkbenchDoorLogEvent.ProviderRead, { ...audit, outcome: answer.kind, rows: rowCountOf(answer), from: "store" })
        return { data: JSON.stringify({ ...answer, source: "synced", asOf: stored.occurredAt.toISOString() }) }
    }

    /**
     * Stores a live answer the provider gave for the account, when the account is one of the caller's workspace, as its
     * `interface.snapshot` (the latest answer wins). A failure to store (an answer too large included) is logged and never fails the read.
     */
    private async keep(
        viewer: InterfaceViewer,
        connectionId: string,
        asked: InterfaceCall,
        answer: InterfaceProviderAnswer,
        durationMs: number,
        audit: Readonly<Record<string, string>>,
    ): Promise<void> {
        const entityManager = this.entityManager
        const intake = this.intake
        if (entityManager === undefined || intake === undefined) return
        const value = {
            verb: asked.verb,
            argsHash: asked.argsHash,
            status: answer.kind,
            durationMs: Math.max(0, Math.round(durationMs)),
            rows: rowCountOf(answer),
            memberId: viewer.memberId,
            answer,
        }
        await entityManager
            .transaction(async (tx) => {
                if (!(await this.ofCallerWorkspace(viewer, connectionId, tx))) return
                await intake.write(tx, connectionId, [{ type: INTERFACE_SNAPSHOT_TYPE, value }])
            })
            .catch((cause: unknown) => {
                this.logger.error(WorkbenchDoorLogEvent.ProviderRead, cause, { ...audit, outcome: "store_unwritable" })
            })
    }

    /** True when the connection belongs to the caller's workspace; false without the connections read (nothing is served or stored). */
    private async ofCallerWorkspace(viewer: InterfaceViewer, connectionId: string, manager?: EntityManager): Promise<boolean> {
        const on = manager ?? this.entityManager
        if (this.bindings === undefined || on === undefined) return false
        return (await this.bindings.workspaceOf(connectionId, on)) === viewer.workspaceId
    }

    /** The current instant in milliseconds by the injected clock; 0 without one, so a duration reads 0. */
    private nowMs(): number {
        return this.clock?.now().getTime() ?? 0
    }

    /** The current state of one account of the workspace (`<provider>:info`), answered as `{ kind: "info", ... }`. */
    private async info(
        provider: InterfaceReadProvider,
        call: DoorCall,
        connectionId: unknown,
        audit: Readonly<Record<string, string>>,
    ): Promise<DoorAnswer> {
        if (provider.infoOf === undefined) throw this.unknown(call.name)
        if (typeof connectionId !== "string" || connectionId === "") {
            throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.PayloadInvalid, params: { issues: "connectionId" } })
        }
        const info = await provider.infoOf(call.workspaceId, connectionId)
        if (info === null) throw this.unknown(call.name)
        this.logger.info(WorkbenchDoorLogEvent.ProviderRead, { ...audit, outcome: "info", rows: info.figures.length })
        // An account's info is drawn from what the connection stores: `synced`, as of the provider's last event or sync.
        return { data: JSON.stringify({ kind: "info", ...info, source: "synced", asOf: info.asOf ?? null }) }
    }

    /**
     * A registry read of any provider (`config`, `rights`): the same member proof, permission seam and audit line as every
     * provider read. Each names one account of the proven workspace.
     */
    private async registryRead(
        registry: ProviderRegistryReads,
        memberId: string,
        call: DoorCall,
        name: ProviderReadName,
    ): Promise<DoorAnswer> {
        if (!mayReadProvider({ workspaceId: call.workspaceId, memberId }, name)) {
            throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.PermissionDenied, params: { permission: call.name } })
        }
        const parsed = parsePayload(call.payload)
        const connectionId: unknown = parsed.ok ? parsed.value.connectionId : undefined
        const account = typeof connectionId === "string" ? connectionId : ""
        if (account === "") {
            throw new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.PayloadInvalid, params: { issues: "connectionId" } })
        }
        const answers: Readonly<Record<string, () => Promise<object | null>>> = {
            config: () => registry.configOf(call.workspaceId, name.provider, account),
            rights: () => registry.rightsOf(call.workspaceId, name.provider, account),
        }
        const answer = await answers[name.read]?.()
        if (answer === null || answer === undefined) throw this.unknown(call.name)
        this.logger.info(WorkbenchDoorLogEvent.ProviderRead, {
            workspaceId: call.workspaceId,
            memberId,
            provider: name.provider,
            read: name.read,
            outcome: name.read,
            rows: 1,
        })
        return { data: JSON.stringify({ kind: name.read, ...answer }) }
    }

    private unknown(name: string): WorkbenchDoorError {
        return new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.ReadUnknown, params: { name } })
    }
}
