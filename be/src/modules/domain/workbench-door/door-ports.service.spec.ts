import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { SdkDefinitionError } from "@nivo-lite/agent-sdk/block"
import type { ListShape } from "@nivo-lite/agent-sdk/block"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { OUTBOX_PORT_ID } from "@nivo-lite/agent-sdk/mutation"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { EntityEngineService, EntityPortsService, ListSourceService } from "@modules/domain/entity-engine"
import type { RunIn, ScopedTx } from "@modules/domain/entity-engine"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { DoorPortsService } from "./door-ports.service"
import type { DoorRun } from "./door-ports.service"
import { WORKBENCH_DOOR_OPTIONS } from "./workbench-door.decorators"

const SHAPE: ListShape = {
    sort: { recent: [["updatedAt", "desc"]] },
    page: { size: 30 },
    row: { id: "id", title: "name" },
}

const QUERY = { q: null, filters: {}, sort: "recent", cursor: null, size: 30 }

const RECORD: RecordRow = {
    id: "lead-1",
    workspaceId: "ws-1",
    version: "3",
    createdAt: "2026-11-05T01:00:00.000Z",
    updatedAt: "2026-11-05T02:00:00.000Z",
    data: { name: "An", id: "from-data", stage: "new" },
}

const build = async () => {
    const lead = mock<EntityDefinition>({ name: "sales.lead", dataKind: "lead" })
    const engine = mock<EntityEngineService>({ catalog: new Map([["sales.lead", lead]]) })
    const ports = mock<EntityPortsService>()
    const lists = mock<ListSourceService>()
    const tx = mock<ScopedTx>()
    const installations = mock<InstallationRecordsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DoorPortsService,
            { provide: WORKBENCH_DOOR_OPTIONS, useValue: { modules: [], entities: [], registryHash: "hash-1" } },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityPortsService, useValue: ports },
            { provide: ListSourceService, useValue: lists },
        ],
    }).compile()
    const runIn: RunIn = (use) => use(tx)
    const run: DoorRun = { workspaceId: "ws-1", runIn, name: "sales.leads", dataKind: "lead" }
    return { service: moduleRef.get(DoorPortsService), ports, lists, tx, runIn, run, installations }
}

type PortId = `${string}.${string}`

const portOf = (id: PortId): PortDefinition<unknown> => ({ entry: "port", id })

const ENGINE_PORTS: ReadonlyArray<PortId> = ["engine.entities", "engine.entity.sales.lead", OUTBOX_PORT_ID]

const UNPROVIDED: ReadonlyArray<readonly [string, PortId, string | null]> = [
    ["a list port of a data kind no entity declares", "sales.leads-list", "unknown-kind"],
    ["a list port of a run with no data kind", "sales.leads-list", null],
    ["a port the screen is not given", "engine.door", "lead"],
]

describe("DoorPortsService", () => {
    it.each(ENGINE_PORTS)("gives the engine port %s the handle the engine provides, bound to the run", async (id) => {
        const { service, ports, run, runIn } = await build()
        const handle = { get: jest.fn() }
        ports.portsFor.mockReturnValue({ port: handle })
        const port = portOf(id)

        const implementation = service.providerFor(run).implementationOf(port)

        expect(implementation).toBe(handle)
        expect(ports.portsFor).toHaveBeenCalledWith(runIn, "action", { port })
    })

    it("gives a list port the generic list source over the entity of the data kind of the read", async () => {
        const { service, lists, tx, run } = await build()
        lists.page.mockResolvedValue({ rows: [RECORD], next: "cursor-2" })
        const source = service.providerFor(run).implementationOf(portOf("sales.leads-list"))

        const page = await (isListSource(source) ? source.page(SHAPE, QUERY) : Promise.reject(new Error("no source")))

        expect(lists.page).toHaveBeenCalledWith(tx, {
            read: "sales.leads",
            entity: "sales.lead",
            shape: SHAPE,
            query: QUERY,
        })
        expect(page).toEqual({
            rows: [
                {
                    name: "An",
                    stage: "new",
                    id: "lead-1",
                    version: "3",
                    createdAt: "2026-11-05T01:00:00.000Z",
                    updatedAt: "2026-11-05T02:00:00.000Z",
                },
            ],
            cursor: "cursor-2",
        })
    })

    it("counts through the generic list source in the same scope", async () => {
        const { service, lists, tx, run } = await build()
        lists.counts.mockResolvedValue({ new: 2, won: 3 })
        const source = service.providerFor(run).implementationOf(portOf("sales.leads-list"))

        const counts = await (isListSource(source)
            ? source.counts(SHAPE, "stage", QUERY)
            : Promise.reject(new Error("no source")))

        expect(lists.counts).toHaveBeenCalledWith(tx, { entity: "sales.lead", shape: SHAPE, by: "stage", query: QUERY })
        expect(counts).toEqual({ new: 2, won: 3 })
    })

    it("gives the installation port the registry hash and the modules the workspace has installed", async () => {
        const { service, installations, run } = await build()
        installations.list.mockResolvedValue([
            mock<InstallationRecord>({ moduleKey: "sales" }),
            mock<InstallationRecord>({ moduleKey: "loyalty" }),
        ])

        const source = service.providerFor(run).implementationOf(portOf("platform.installation"))
        const facts = await (isInstallationSource(source) ? source.current() : Promise.reject(new Error("no source")))

        expect(installations.list).toHaveBeenCalledWith("ws-1")
        expect(facts).toEqual({ registryHash: "hash-1", modules: [], enabled: ["sales", "loyalty"] })
    })

    it.each(UNPROVIDED)("reports %s as unprovided", async (_label, id, dataKind) => {
        const { service, run } = await build()

        const provider = service.providerFor({ ...run, dataKind })

        expect(() => provider.implementationOf(portOf(id))).toThrow(SdkDefinitionError)
        expect(() => provider.implementationOf(portOf(id))).toThrow(`PORT_UNPROVIDED: ${id}`)
    })
})

/** Narrows the implementation of a list port to the two methods of a list source. */
const isListSource = (
    value: unknown,
): value is {
    readonly page: (shape: ListShape, query: typeof QUERY) => Promise<unknown>
    readonly counts: (shape: ListShape, by: string, query: typeof QUERY) => Promise<unknown>
} => typeof value === "object" && value !== null && "page" in value && "counts" in value

/** Narrows the implementation of the installation port to its one method. */
const isInstallationSource = (value: unknown): value is { readonly current: () => Promise<unknown> } =>
    typeof value === "object" && value !== null && "current" in value
