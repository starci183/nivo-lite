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
import { MemberGrantsService } from "@modules/domain/member-grants"
import type { MemberGrant } from "@modules/domain/member-grants"
import { MemberLookupService } from "@modules/domain/workspace-members"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { ParkedRuns } from "@nivo-lite/blocks-core/modules"
import { ParkedRunsService, PlatformRegionsService } from "@modules/domain/platform-ports"
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
    const grants = mock<MemberGrantsService>()
    const regions = mock<PlatformRegionsService>()
    const parked = mock<ParkedRunsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DoorPortsService,
            { provide: WORKBENCH_DOOR_OPTIONS, useValue: { modules: [], entities: [], registryHash: "hash-1" } },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityPortsService, useValue: ports },
            { provide: ListSourceService, useValue: lists },
            { provide: MemberLookupService, useValue: seats },
            { provide: MemberGrantsService, useValue: grants },
            { provide: PlatformRegionsService, useValue: regions },
            { provide: ParkedRunsService, useValue: parked },
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
        grants,
        regions,
        parked,
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

        const page = await (isListSource(source) ? source.page(SHAPE, QUERY) : Promise.reject(new Error("no source")))

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

describe("DoorPortsService members", () => {
    it("gives the members port the active seat of the run's workspace", async () => {
        const { service, seats, run } = await build()
        seats.activeSeatById.mockResolvedValue({ displayName: "Lan", isManager: true })
        const directory = service.providerFor(run).implementationOf(portOf("platform.members"))

        const seat = await (isMemberDirectory(directory)
            ? directory.get("m-1")
            : Promise.reject(new Error("no directory")))

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
        granted: ReadonlyArray<string>,
        memberId: string | null,
    ): Promise<unknown> => {
        const { service, seats, grants, run } = await build()
        seats.activeSeatById.mockResolvedValue(seat)
        grants.forAction.mockResolvedValue(granted.map((id) => mock<MemberGrant>({ member_id: id })))
        const directory = service.providerFor(run).implementationOf(portOf("platform.rights"))
        return isRightsDirectory(directory)
            ? directory.holds(memberId, "sales.approve")
            : Promise.reject(new Error("no directory"))
    }

    it("holds every permission for an owner or a manager without looking at the grants", async () => {
        const { service, seats, grants, run } = await build()
        seats.activeSeatById.mockResolvedValue({ displayName: "Lan", isManager: true })
        const directory = service.providerFor(run).implementationOf(portOf("platform.rights"))

        const answer = await (isRightsDirectory(directory)
            ? directory.holds("m-1", "sales.approve")
            : Promise.reject(new Error("no directory")))

        expect(answer).toBe(true)
        expect(seats.activeSeatById).toHaveBeenCalledWith("ws-1", "m-1")
        expect(grants.forAction).not.toHaveBeenCalled()
    })

    it("holds a permission for a staff member the workspace granted it to, and for no other", async () => {
        const staff = { displayName: "Ha", isManager: false }
        expect(await holds(staff, ["m-1"], "m-1")).toBe(true)
        expect(await holds(staff, ["m-2"], "m-1")).toBe(false)
    })

    it("holds nothing for a seat the workspace has not, and nothing for the agent", async () => {
        expect(await holds(null, ["m-1"], "m-1")).toBe(false)
        expect(await holds({ displayName: "Lan", isManager: true }, [], null)).toBe(false)
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
            { provide: MemberGrantsService, useValue: mock<MemberGrantsService>() },
        ],
    }).compile()
    return moduleRef.get(DoorPortsService)
}

describe("DoorPortsService platform ports", () => {
    it("serves the agent regions in the language of the run, and lets a caller ask for another", async () => {
        const { service, regions, run } = await build()
        regions.connectionsWithCandidatesOf.mockResolvedValue({ manageLabel: "m", manageHref: "", rows: [] })
        const connections = service
            .providerFor({ ...run, locale: "en" })
            .implementationOf(portOf("platform.agent-connections"))
        await (isRegionPort(connections) ? connections.of("a1") : Promise.reject(new Error("no port")))
        await (isRegionPort(connections) ? connections.of("a1", "vi") : Promise.reject(new Error("no port")))
        expect(regions.connectionsWithCandidatesOf.mock.calls).toEqual([
            ["ws-1", "a1", "en"],
            ["ws-1", "a1", "vi"],
        ])
        const knowledge = service.providerFor(run).implementationOf(portOf("platform.agent-knowledge"))
        await (isRegionPort(knowledge) ? knowledge.of("a2") : Promise.reject(new Error("no port")))
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

    it.each(["platform.agent-connections", "platform.agent-knowledge", "platform.parked-runs"] as const)(
        "reports %s as unprovided in an app that registered no platform ports",
        async (id) => {
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
        },
    )
})
