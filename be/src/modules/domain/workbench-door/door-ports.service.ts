import { Injectable, Optional } from "@nestjs/common"
import { unprovided, type PortDefinition, type PortProvider } from "@nivo-lite/agent-sdk/port"
import type { ListPage, ListSource } from "@nivo-lite/agent-sdk/block"
import type {
    AgentConnections,
    AgentKnowledge,
    CoreReads,
    CustomerMessages,
    InstallationSource,
    MemberDirectory,
    ParkedRuns,
    RightsDirectory,
    RouteHolds,
} from "@nivo-lite/agent-sdk/platform"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { EntityEngineService, EntityPortsService, ListSourceService, type RunIn } from "@modules/domain/entity-engine"
import {
  AgentDeskService,
  CoreReadsService,
  CustomerMessagesPortService,
  ParkedRunsService,
  PlatformRegionsService,
  RouteHoldsPortService,
  type AgentDesk,
} from "@modules/domain/platform-ports"
import { MemberLookupService } from "@modules/domain/workspace-members"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { Locale } from "@modules/platform/i18n"
import { portKindOf } from "./door-port-kind.policy"
import { WorkbenchDoorError, WorkbenchDoorErrorCode } from "./errors/workbench-door.error"
import { installationFactsOf } from "./installation-facts.policy"
import { InjectWorkbenchDoorOptions } from "./workbench-door.decorators"
import type { WorkbenchDoorOptions } from "./workbench-door.options"

/** What the ports of one run are bound to. */
export interface DoorRun {
    /** The workspace the run is for; the installation port reads which modules it has enabled. */
    readonly workspaceId: string
    /** Where each port call runs: the one transaction of the run, or a transaction of its own per call. */
    readonly runIn: RunIn
    /** The id of the read or action, which binds a list cursor to its list. */
    readonly name: string
    /** The data kind of the rows the run lists, from which the entity is resolved; null for an action. */
    readonly dataKind: string | null
    /** The seat that asks; null when none. */
    readonly memberId: string | null
    /** The language of the viewer. */
    readonly locale: Locale
    /** The fields the read declares (`fields`): the only record fields a list of the run carries; empty for an action. */
    readonly fields: ReadonlyArray<string>
}

/** A row as a screen reads it: the declared fields, then the system fields `id`, `version`, `createdAt` and `updatedAt`. */
const rowOf = (record: RecordRow): Readonly<Record<string, unknown>> => ({
    ...record.data,
    id: record.id,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
})

@Injectable()
/**
 * The ports a screen's read or action receives: the engine's data and outbox ports, the installation (the registry and the workspace's enabled modules), the workspace's active seats and the permissions they hold, and a module's list source as the generic one over
 * the entity of the read's data kind. Every other port is `unprovided`, which the run reports as a failure.
 */
export class DoorPortsService {
    constructor(
        @InjectWorkbenchDoorOptions() private readonly options: WorkbenchDoorOptions,
        private readonly installations: InstallationRecordsService,
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
        private readonly lists: ListSourceService,
        private readonly seats: MemberLookupService,
        @Optional() private readonly regions?: PlatformRegionsService,
        @Optional() private readonly parked?: ParkedRunsService,
        @Optional() private readonly desk?: AgentDeskService,
        @Optional() private readonly core?: CoreReadsService,
        @Optional() private readonly conversations?: CustomerMessagesPortService,
        @Optional() private readonly holds?: RouteHoldsPortService,
    ) {}

    /** The provider of the ports of one run. */
    providerFor(run: DoorRun): PortProvider {
        return { implementationOf: (port) => this.implementationOf(run, port) }
    }

    private implementationOf(run: DoorRun, port: PortDefinition<unknown>): unknown {
        const kind = portKindOf(port.id)
        if (kind === "installation") return this.installationSource(run.workspaceId)
        if (kind === "members") return this.memberDirectory(run.workspaceId)
        if (kind === "rights") return this.rightsDirectory(run.workspaceId)
        if (kind === "agent-connections") return this.agentConnections(run, port)
        if (kind === "agent-knowledge") return this.agentKnowledge(run, port)
        if (kind === "parked-runs") return this.parkedRuns(run, port)
        if (kind === "agent-desk") return this.agentDesk(run, port)
        if (kind === "core") return this.coreReads(run, port)
        if (kind === "customer-messages") return this.customerMessages(run, port)
        if (kind === "route-holds") return this.routeHolds(run, port)
        if (kind === "engine") return this.ports.portsFor(run.runIn, "action", { port })["port"]
        const entity = [...this.engine.catalog.values()].find((declared) => declared.dataKind === run.dataKind)
        return kind === "list" && entity !== undefined ? this.listSource(run, entity) : unprovided(port)
    }

    private parkedRuns(run: DoorRun, port: PortDefinition<unknown>): ParkedRuns | never {
        return (
            this.parked?.portFor({ workspaceId: run.workspaceId, memberId: run.memberId, locale: run.locale }) ??
            unprovided(port)
        )
    }

    private agentDesk(run: DoorRun, port: PortDefinition<unknown>): AgentDesk | never {
        const asker = { workspaceId: run.workspaceId, memberId: run.memberId, locale: run.locale }
        return this.desk?.portFor(asker) ?? unprovided(port)
    }

    private coreReads(run: DoorRun, port: PortDefinition<unknown>): CoreReads | never {
        return this.core?.portFor(run.workspaceId) ?? unprovided(port)
    }

    private customerMessages(run: DoorRun, port: PortDefinition<unknown>): CustomerMessages | never {
        return this.conversations?.portFor(run.workspaceId) ?? unprovided(port)
    }

    /**
     * The staff hold of a customer's route, acting as the run's seat. A run with no seat (a job) may read who holds a route and the held
     * routes of the workspace, but taking
     * or handing one back refuses with the typed `PermissionDenied` (reason `no_member`), never a silent act.
     */
    private routeHolds(run: DoorRun, port: PortDefinition<unknown>): RouteHolds | never {
        const holds = this.holds
        if (holds === undefined) return unprovided(port)
        const memberId = run.memberId
        if (memberId !== null) return holds.portFor({ workspaceId: run.workspaceId, memberId }) ?? unprovided(port)
        const reader = holds.portFor({ workspaceId: run.workspaceId, memberId: "" })
        if (reader === null) return unprovided(port)
        const refused = (): Promise<never> =>
            Promise.reject(
                new WorkbenchDoorError({
                    code: WorkbenchDoorErrorCode.PermissionDenied,
                    params: { port: port.id, reason: "no_member" },
                }),
            )
        return { take: refused, holderOf: (routeId) => reader.holderOf(routeId), handBack: refused, held: (limit) => reader.held(limit) }
    }

    private agentConnections(run: DoorRun, port: PortDefinition<unknown>): AgentConnections | never {
        const regions = this.regions
        if (regions === undefined) return unprovided(port)
        return {
            of: (agentId, locale = run.locale) =>
                regions.connectionsOf(run.workspaceId, agentId, locale),
        }
    }

    private agentKnowledge(run: DoorRun, port: PortDefinition<unknown>): AgentKnowledge | never {
        const regions = this.regions
        if (regions === undefined) return unprovided(port)
        return { of: (agentId, locale = run.locale) => regions.knowledgeOf(run.workspaceId, agentId, locale) }
    }

    private memberDirectory(workspaceId: string): MemberDirectory {
        return { get: (memberId) => this.seats.activeSeatById(workspaceId, memberId) }
    }

    /** Owners and managers hold every permission of every module; a staff member holds none (a person's power is their role). */
    private rightsDirectory(workspaceId: string): RightsDirectory {
        return {
            holds: async (memberId) => {
                if (memberId === null) return false
                const seat = await this.seats.activeSeatById(workspaceId, memberId)
                if (seat === null) return false
                return seat.isManager
            },
        }
    }

    private installationSource(workspaceId: string): InstallationSource {
        return {
            current: async () => {
                const records = await this.installations.list(workspaceId)
                return installationFactsOf(
                    this.options.modules,
                    this.options.registryHash,
                    records.map((record) => record.moduleKey),
                )
            },
        }
    }

    /**
     * A list source over one entity: a row carries the fields the READ declares (beyond the shape's row fields), so a block draws a column
     * the shape's row does not name, and a field the read did not declare never leaves the door, whatever the entity holds.
     */
    private listSource(run: DoorRun, declared: EntityDefinition): ListSource<unknown> {
        const entity = declared.name
        const held = Object.keys(declared.fields)
        const select = run.fields.filter((field) => held.includes(field))
        return {
            page: async (shape, query): Promise<ListPage<unknown>> => {
                const found = await run.runIn((tx) =>
                    this.lists.page(tx, { read: run.name, entity, shape, query, select }),
                )
                return { rows: found.rows.map((record) => rowOf(record)), cursor: found.next }
            },
            counts: (shape, by, query) => run.runIn((tx) => this.lists.counts(tx, { entity, shape, by, query })),
        }
    }
}
