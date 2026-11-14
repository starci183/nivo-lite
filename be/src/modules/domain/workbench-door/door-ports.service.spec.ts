import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { SdkDefinitionError } from "@nivo-lite/agent-sdk/block"
import type { ListShape } from "@nivo-lite/agent-sdk/block"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { EntityApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { OUTBOX_PORT_ID } from "@nivo-lite/agent-sdk/mutation"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { EntityEngineService, EntityPortsService, ListSourceService } from "@modules/domain/entity-engine"
import type { RunIn, ScopedTx } from "@modules/domain/entity-engine"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { MemberLookupService } from "@modules/domain/workspace-members"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { CoreReads, CustomerMessages, ParkedRuns, RouteHolds } from "@nivo-lite/agent-sdk/platform"
import {
    AgentDeskService,
    CoreReadsService,
    CustomerMessagesPortService,
    ParkedRunsService,
    PlatformRegionsService,
    RouteHoldsPortService,
} from "@modules/domain/platform-ports"
import type { AgentDesk } from "@modules/domain/platform-ports"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { DoorPortsService } from "./door-ports.service"
import type { DoorRun } from "./door-ports.service"
import { WORKBENCH_DOOR_OPTIONS } from "./workbench-door.decorators"
import { WorkbenchDoorError, WorkbenchDoorErrorCode } from "./errors/workbench-door.error"

/** A rejection for a branch a type guard should make unreachable. */
const absent = (): Promise<never> =>
    Promise.reject(new WorkbenchDoorError({ code: WorkbenchDoorErrorCode.PortUnprovided }))

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
    const lead = mock<EntityDefinition>({
        name: "sales.lead",
        dataKind: "lead",
        fields: {
            name: { kind: "text", nullable: false },
            stage: { kind: "text", nullable: false },
            phone: { kind: "text", nullable: true },
        },
    })
    const engine = mock<EntityEngineService>({ catalog: new Map([["sales.lead", lead]]) })
    const ports = mock<EntityPortsService>()
    const lists = mock<ListSourceService>()
    const tx = mock<ScopedTx>()
    const installations = mock<InstallationRecordsService>()
    const seats = mock<MemberLookupService>()
    const regions = mock<PlatformRegionsService>()
    const parked = mock<ParkedRunsService>()
    const desk = mock<AgentDeskService>()
    const core = mock<CoreReadsService>()
    const conversations = mock<CustomerMessagesPortService>()
    const holds = mock<RouteHoldsPortService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DoorPortsService,
            { provide: WORKBENCH_DOOR_OPTIONS, useValue: { modules: [], entities: [], registryHash: "hash-1" } },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityPortsService, useValue: ports },
            { provide: ListSourceService, useValue: lists },
            { provide: MemberLookupService, useValue: seats },
            { provide: PlatformRegionsService, useValue: regions },
            { provide: ParkedRunsService, useValue: parked },
            { provide: AgentDeskService, useValue: desk },
            { provide: CoreReadsService, useValue: core },
            { provide: CustomerMessagesPortService, useValue: conversations },
            { provide: RouteHoldsPortService, useValue: holds },
        ],
    }).compile()
    const runIn: RunIn = (use) => use(tx)
    const run: DoorRun = {
        workspaceId: "ws-1",
        runIn,
        name: "sales.leads",
        dataKind: "lead",
        memberId: "m1",
        locale: "vi",
        fields: ["id", "name", "stage", "unknown"],
    }
    return {
        service: moduleRef.get(DoorPortsService),
        ports,
        lists,
        tx,
        runIn,
        run,
        installations,
        seats,
        regions,
        parked,
        desk,
        core,
        conversations,
        holds,
    }
}

/** A region port: `of(agentId, locale?)`. */
interface RegionPort {
    readonly of: (agentId: string, locale?: "vi" | "en") => Promise<unknown>
}

const isRegionPort = (value: unknown): value is RegionPort =>
    typeof value === "object" && value !== null && "of" in value

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

        const page = await (isListSource(source) ? source.page(SHAPE, QUERY) : absent())

        expect(lists.page).toHaveBeenCalledWith(tx, {
            read: "sales.leads",
            entity: "sales.lead",
            shape: SHAPE,
            query: QUERY,
            select: ["name", "stage"],
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

        const counts = await (isListSource(source) ? source.counts(SHAPE, "stage", QUERY) : absent())

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
        const facts = await (isInstallationSource(source) ? source.current() : absent())

        expect(installations.list).toHaveBeenCalledWith("ws-1")
        expect(facts).toEqual({ registryHash: "hash-1", modules: [], enabled: ["sales", "loyalty"] })
    })

    it.each(UNPROVIDED)("reports %s as unprovided", async (_label, id, dataKind) => {
        const { service, run } = await build()

        const provider = service.providerFor({ ...run, dataKind })

        // An SDK error is a `DomainError` now: its message is its code, and the port id is in `params.at` (the old `PORT_UNPROVIDED: <id>` text is gone on purpose).
        expect(() => provider.implementationOf(portOf(id))).toThrow(SdkDefinitionError)
        expect(() => provider.implementationOf(portOf(id))).toThrow(
            expect.objectContaining({ code: "PORT_UNPROVIDED", params: { at: id } }),
        )
    })
})

/** Narrows the implementation of a list port to the two methods of a list source. */
const isListSource = (
    value: unknown,
): value is {
    readonly page: (shape: ListShape, query: typeof QUERY) => Promise<unknown>
    readonly counts: (shape: ListShape, by: string, query: typeof QUERY) => Promise<unknown>
} => typeof value === "object" && value !== null && "page" in value && "counts" in value

describe("DoorPortsService members", () => {
    it("gives the members port the active seat of the run's workspace", async () => {
        const { service, seats, run } = await build()
        seats.activeSeatById.mockResolvedValue({ displayName: "Lan", isManager: true })
        const directory = service.providerFor(run).implementationOf(portOf("platform.members"))

        const seat = await (isMemberDirectory(directory) ? directory.get("m-1") : absent())

        expect(seat).toEqual({ displayName: "Lan", isManager: true })
        expect(seats.activeSeatById).toHaveBeenCalledWith("ws-1", "m-1")
    })
})

/** Narrows the implementation of the installation port to its one method. */
const isInstallationSource = (value: unknown): value is { readonly current: () => Promise<unknown> } =>
    typeof value === "object" && value !== null && "current" in value

/** Narrows the implementation of the members port to its one method. */
const isMemberDirectory = (value: unknown): value is { readonly get: (memberId: string) => Promise<unknown> } =>
    typeof value === "object" && value !== null && "get" in value

describe("DoorPortsService rights", () => {
    const holds = async (
        seat: { readonly displayName: string; readonly isManager: boolean } | null,
        memberId: string | null,
    ): Promise<unknown> => {
        const { service, seats, run } = await build()
        seats.activeSeatById.mockResolvedValue(seat)
        const directory = service.providerFor(run).implementationOf(portOf("platform.rights"))
        return isRightsDirectory(directory) ? directory.holds(memberId, "sales.approve") : absent()
    }

    it("holds every permission for an owner or a manager", async () => {
        const { service, seats, run } = await build()
        seats.activeSeatById.mockResolvedValue({ displayName: "Lan", isManager: true })
        const directory = service.providerFor(run).implementationOf(portOf("platform.rights"))

        const answer = await (isRightsDirectory(directory) ? directory.holds("m-1", "sales.approve") : absent())

        expect(answer).toBe(true)
        expect(seats.activeSeatById).toHaveBeenCalledWith("ws-1", "m-1")
    })

    it("holds no permission for a staff member: the power of a person is the role, and nothing is granted to a seat", async () => {
        expect(await holds({ displayName: "Ha", isManager: false }, "m-1")).toBe(false)
    })

    it("holds nothing for a seat the workspace has not, and nothing for the agent", async () => {
        expect(await holds(null, "m-1")).toBe(false)
        expect(await holds({ displayName: "Lan", isManager: true }, null)).toBe(false)
    })
})

/** Narrows the implementation of the rights port to its one method. */
const isRightsDirectory = (
    value: unknown,
): value is { readonly holds: (memberId: string | null, permission: string) => Promise<unknown> } =>
    typeof value === "object" && value !== null && "holds" in value

/** The door ports of an app that registered no platform ports: only what every app has. */
const buildBare = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            DoorPortsService,
            { provide: WORKBENCH_DOOR_OPTIONS, useValue: { modules: [], entities: [], registryHash: "hash-1" } },
            { provide: InstallationRecordsService, useValue: mock<InstallationRecordsService>() },
            { provide: EntityEngineService, useValue: mock<EntityEngineService>({ catalog: new Map() }) },
            { provide: EntityPortsService, useValue: mock<EntityPortsService>() },
            { provide: ListSourceService, useValue: mock<ListSourceService>() },
            { provide: MemberLookupService, useValue: mock<MemberLookupService>() },
        ],
    }).compile()
    return moduleRef.get(DoorPortsService)
}

describe("DoorPortsService platform ports", () => {
    it("serves the agent regions in the language of the run, and lets a caller ask for another", async () => {
        const { service, regions, run } = await build()
        regions.connectionsOf.mockResolvedValue({ label: "l", rightsLabel: "r", rightsHref: "", rows: [] })
        const connections = service
            .providerFor({ ...run, locale: "en" })
            .implementationOf(portOf("platform.agent-connections"))
        await (isRegionPort(connections) ? connections.of("a1") : absent())
        await (isRegionPort(connections) ? connections.of("a1", "vi") : absent())
        expect(regions.connectionsOf.mock.calls).toEqual([
            ["ws-1", "a1", "en"],
            ["ws-1", "a1", "vi"],
        ])
        const knowledge = service.providerFor(run).implementationOf(portOf("platform.agent-knowledge"))
        await (isRegionPort(knowledge) ? knowledge.of("a2") : absent())
        expect(regions.knowledgeOf.mock.calls).toEqual([["ws-1", "a2", "vi"]])
    })

    it("serves the parked runs for the asker of the run", async () => {
        const { service, parked, run } = await build()
        const served = mock<ParkedRuns>()
        parked.portFor.mockReturnValue(served)
        const port = service.providerFor(run).implementationOf(portOf("platform.parked-runs"))
        expect(port).toBe(served)
        expect(parked.portFor).toHaveBeenCalledWith({ workspaceId: "ws-1", memberId: "m1", locale: "vi" })
    })

    it("serves every port the runs list declares, the desk included, so its rows carry the desk facts", async () => {
        const { service, desk, core, ports: engine, run } = await build()
        desk.portFor.mockReturnValue(mock<AgentDesk>())
        core.portFor.mockReturnValue(mock<CoreReads>())
        engine.portsFor.mockReturnValue({ port: mock<EntityApi>() })
        const runs = INSTALLED.moduleOf("platform")?.reads.find((read) => read.id === "platform.agent-runs")
        const ports = Object.values(runs?.ports ?? {})
        expect(ports.map((port) => port.id)).toContain("platform.agent-desk")
        for (const port of ports) expect(() => service.providerFor(run).implementationOf(port)).not.toThrow()
    })

    it("serves the core reads (the runs of the agents) for the workspace of the run", async () => {
        const { service, core, run } = await build()
        const served = mock<CoreReads>()
        core.portFor.mockReturnValue(served)
        const port = service.providerFor(run).implementationOf(portOf("platform.core"))
        expect(port).toBe(served)
        expect(core.portFor).toHaveBeenCalledWith("ws-1")
    })

    it("serves the conversation with the customers for the workspace of the run, not narrowed by a seat", async () => {
        const { service, conversations, run } = await build()
        const served = mock<CustomerMessages>()
        conversations.portFor.mockReturnValue(served)
        const port = service.providerFor(run).implementationOf(portOf("platform.customer-messages"))
        expect(port).toBe(served)
        expect(conversations.portFor).toHaveBeenCalledWith("ws-1")
    })

    it("serves the staff hold of a route as the run's seat (R43)", async () => {
        const { service, holds, run } = await build()
        const served = mock<RouteHolds>()
        holds.portFor.mockReturnValue(served)
        const port = service.providerFor(run).implementationOf(portOf("platform.route-holds"))
        expect(port).toBe(served)
        expect(holds.portFor).toHaveBeenCalledWith({ workspaceId: "ws-1", memberId: "m1" })
    })

    it("lets a run with no seat read who holds a route and the held routes, and refuses its take and hand-back with a typed error", async () => {
        const { service, holds, run } = await build()
        const page = { count: 1, routes: [{ routeId: "route-1", memberId: "m-staff", at: "2026-11-14T08:00:00.000Z" }] }
        const reader = mock<RouteHolds>({
            holderOf: jest.fn().mockResolvedValue({ memberId: "m-staff", at: "2026-11-14T08:00:00.000Z" }),
            held: jest.fn().mockResolvedValue(page),
        })
        holds.portFor.mockReturnValue(reader)
        const port = service
            .providerFor({ ...run, memberId: null })
            .implementationOf(portOf("platform.route-holds")) as RouteHolds
        await expect(port.holderOf("route-1")).resolves.toEqual({ memberId: "m-staff", at: "2026-11-14T08:00:00.000Z" })
        await expect(port.held(1)).resolves.toEqual(page)
        expect(reader.held).toHaveBeenCalledWith(1)
        await expect(port.take("route-1")).rejects.toMatchObject({
            code: WorkbenchDoorErrorCode.PermissionDenied,
            params: { port: "platform.route-holds", reason: "no_member" },
        })
        await expect(port.handBack("route-1")).rejects.toMatchObject({ code: WorkbenchDoorErrorCode.PermissionDenied })
        expect(reader.take).not.toHaveBeenCalled()
        expect(reader.handBack).not.toHaveBeenCalled()
    })

    it("leaves the route holds unprovided in an app with no hand-back door", async () => {
        const { service, holds, run } = await build()
        holds.portFor.mockReturnValue(null)
        expect(() => service.providerFor(run).implementationOf(portOf("platform.route-holds"))).toThrow()
    })

    it("serves the agent desk for the asker of the run", async () => {
        const { service, desk, run } = await build()
        const served = mock<AgentDesk>()
        desk.portFor.mockReturnValue(served)
        const port = service.providerFor(run).implementationOf(portOf("platform.agent-desk"))
        expect(port).toBe(served)
        expect(desk.portFor).toHaveBeenCalledWith({ workspaceId: "ws-1", memberId: "m1", locale: "vi" })
    })

    it.each([
        "platform.agent-connections",
        "platform.agent-knowledge",
        "platform.parked-runs",
        "platform.agent-desk",
        "platform.core",
    ] as const)("reports %s as unprovided in an app that registered no platform ports", async (id) => {
        const service = await buildBare()
        const run: DoorRun = {
            workspaceId: "ws-1",
            runIn: (use) => use(mock<ScopedTx>()),
            name: "x.y",
            dataKind: null,
            memberId: null,
            locale: "vi",
            fields: [],
        }
        expect(() => service.providerFor(run).implementationOf(portOf(id))).toThrow(SdkDefinitionError)
    })
})
