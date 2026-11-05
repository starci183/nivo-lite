import { Injectable } from "@nestjs/common"
import { unprovided } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition, PortProvider } from "@nivo-lite/agent-sdk/port"
import type { ListPage, ListSource } from "@nivo-lite/agent-sdk/block"
import { EntityEngineService, EntityPortsService, ListSourceService } from "@modules/domain/entity-engine"
import type { RunIn } from "@modules/domain/entity-engine"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { portKindOf } from "./door-port-kind.policy"

/** What the ports of one run are bound to. */
export interface DoorRun {
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
 * The ports a screen's read or action receives: the engine's data and outbox ports, and a module's list source as the generic one over
 * the entity of the read's data kind. Every other port is `unprovided`, which the run reports as a failure.
 */
export class DoorPortsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
        private readonly lists: ListSourceService,
    ) {}

    /** The provider of the ports of one run. */
    providerFor(run: DoorRun): PortProvider {
        return { implementationOf: (port) => this.implementationOf(run, port) }
    }

    private implementationOf(run: DoorRun, port: PortDefinition<unknown>): unknown {
        const kind = portKindOf(port.id)
        if (kind === "engine") return this.ports.portsFor(run.runIn, "action", { port })["port"]
        const entity = [...this.engine.catalog.values()].find((declared) => declared.dataKind === run.dataKind)
        return kind === "list" && entity !== undefined ? this.listSource(run, entity.name) : unprovided(port)
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
