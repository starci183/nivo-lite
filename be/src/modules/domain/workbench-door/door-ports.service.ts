import { Injectable } from "@nestjs/common"
import { unprovided } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition, PortProvider } from "@nivo-lite/agent-sdk/port"
import type { ListPage, ListSource } from "@nivo-lite/agent-sdk/block"
import type { InstallationSource, MemberDirectory, RightsDirectory } from "@nivo-lite/blocks-core/modules"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { EntityEngineService, EntityPortsService, ListSourceService } from "@modules/domain/entity-engine"
import { MemberGrantsService } from "@modules/domain/member-grants"
import { MemberLookupService } from "@modules/domain/workspace-members"
import type { RunIn } from "@modules/domain/entity-engine"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { portKindOf } from "./door-port-kind.policy"
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
        private readonly grants: MemberGrantsService,
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
        if (kind === "engine") return this.ports.portsFor(run.runIn, "action", { port })["port"]
        const entity = [...this.engine.catalog.values()].find((declared) => declared.dataKind === run.dataKind)
        return kind === "list" && entity !== undefined ? this.listSource(run, entity.name) : unprovided(port)
    }

    private memberDirectory(workspaceId: string): MemberDirectory {
        return { get: (memberId) => this.seats.activeSeatById(workspaceId, memberId) }
    }

    /** Owners and managers hold every permission of every module; a staff member holds the ones the workspace granted to the seat. */
    private rightsDirectory(workspaceId: string): RightsDirectory {
        return {
            holds: async (memberId, permission) => {
                if (memberId === null) return false
                const seat = await this.seats.activeSeatById(workspaceId, memberId)
                if (seat === null) return false
                if (seat.isManager) return true
                const grants = await this.grants.forAction(workspaceId, permission)
                return grants.some((grant) => grant.member_id === memberId)
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

    private listSource(run: DoorRun, entity: string): ListSource<unknown> {
        return {
            page: async (shape, query): Promise<ListPage<unknown>> => {
                const found = await run.runIn((tx) => this.lists.page(tx, { read: run.name, entity, shape, query }))
                return { rows: found.rows.map(rowOf), cursor: found.next }
            },
            counts: (shape, by, query) => run.runIn((tx) => this.lists.counts(tx, { entity, shape, by, query })),
        }
    }
}
