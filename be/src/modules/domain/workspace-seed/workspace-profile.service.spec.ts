import { Test } from "@nestjs/testing"
import {
    CONNECTOR_URL,
    OWNED_SEED,
    REMOTE_CONNECTOR,
    ROLE_WIRE,
    SEED_OWNER,
    SEED_WS,
    ensureWireOf,
    profileWireOf,
    seedInstallationOf as installationOf,
} from "@tests/fixtures/builders/workspace-seed.builder"
import { profileDocumentOf } from "@tests/fixtures/builders/workspace-profile-spec.builder"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { WorkspacesService } from "@modules/domain/workspaces"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { PROFILE_RECEIPT_PREFIX } from "./messages/workspace-seed.messages"
import { HAKUEN_PROFILE } from "./profiles/hakuen-profile.templates"
import { WORKSPACE_PROFILES } from "./profiles/workspace-profiles.templates"
import { ProfileActivationService } from "./profile-activation.service"
import type { ProfileAgent, ProfileReport, WorkspaceProfile } from "./workspace-profile.contracts"
import { WorkspaceProfileService } from "./workspace-profile.service"
import {
    SEED_AGENTS,
    SEED_CONNECTORS,
    SEED_SOURCES,
    SEED_TOOL_GRANTS,
    WORKSPACE_SEED_OPTIONS,
} from "./workspace-seed.decorators"
import type { SeedAgentRecords, SeedConnectors, SeedSources, SeedToolGrants } from "./workspace-seed.port"
import { WorkspaceSeedService } from "./workspace-seed.service"

const WS = SEED_WS
const OWNER = SEED_OWNER
const TARGET = { workspaceId: WS, ownerId: OWNER }
const HAKUEN_OWNER = "hakuen.demo@gmail.com"
const agentOf = (handle: string, room: string | null): ProfileAgent => ({
    module: "chatbot",
    name: handle,
    handle,
    role: "role",
    instructions: "instructions",
    room,
    tools:
        room === null
            ? []
            : [
                  { tool: "hakuen.*", mode: "auto", limitVnd: null, constraints: [] },
                  {
                      tool: "hakuen.booking.confirm",
                      mode: "auto",
                      limitVnd: 5_000_000,
                      constraints: [{ arg: "nights", max: 3 }],
                  },
              ],
    setup: [{ gate: "tone", evidence: "warm" }],
})
const PROFILE: WorkspaceProfile = {
    key: "test",
    workspaceName: "Test",
    displayName: "Test Brand",
    logoUrl: "/brand/test.jpg",
    agents: [agentOf("ai-sales", "sales"), agentOf("ai-cskh", null)],
    rules: [
        {
            department: "chatbot",
            action: "reply_customer",
            mode: "auto",
            limit_vnd: null,
            required_fields: [],
            note: "n",
        },
    ],
    connectors: [],
    documents: [profileDocumentOf("new"), profileDocumentOf("same"), profileDocumentOf("changed")],
}
const EMPTY: WorkspaceProfile = { ...PROFILE, agents: [], documents: [], rules: [] }
const PROFILE_WIRE = profileWireOf("hakuen")
const CONNECTOR = REMOTE_CONNECTOR
const ACTOR = { principalId: OWNER, workspaceId: WS }

const build = async (em: MockEntityManager, input?: unknown, profileInput: unknown = PROFILE_WIRE) => {
    const print = jest.fn()
    const connectors = mock<SeedConnectors>()
    const agents = mock<SeedAgentRecords>()
    const sources = mock<SeedSources>()
    const toolGrants = mock<SeedToolGrants>()
    const seeds = mock<WorkspaceSeedService>()
    const workspaces = mock<WorkspacesService>()
    const rules = mock<AuthorityRulesService>()
    const activation = mock<ProfileActivationService>()
    activation.install.mockResolvedValue(installationOf())
    activation.activate.mockImplementation((_target, kept) =>
        Promise.resolve(Object.fromEntries(kept.map((entry) => [entry.handle, "ready" as const]))),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceProfileService,
            {
                provide: WORKSPACE_SEED_OPTIONS,
                useValue: {
                    auth: Symbol("auth"),
                    input: input === undefined ? undefined : new Secret(JSON.stringify(input)),
                    profileInput: profileInput === null ? undefined : new Secret(JSON.stringify(profileInput)),
                    print,
                },
            },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: SEED_AGENTS, useValue: agents },
            { provide: SEED_SOURCES, useValue: sources },
            { provide: SEED_TOOL_GRANTS, useValue: toolGrants },
            { provide: SEED_CONNECTORS, useValue: connectors },
            { provide: WorkspaceSeedService, useValue: seeds },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: ProfileActivationService, useValue: activation },
        ],
    }).compile()
    const service = moduleRef.get(WorkspaceProfileService)
    const doubles = { agents, sources, toolGrants, connectors, seeds, workspaces, rules, activation }
    return { service, print, ...doubles }
}

const ROOMS_FUNCTION_PRESENT = "SELECT * FROM to_regproc($1)"
const ENSURE_OFFICE_ROOMS = "SELECT * FROM public.ensure_office_rooms($1)"
const MOVE_AGENT_HOME = "SELECT * FROM public.move_office_agent_home($1, $2, $3)"
const ROOMS_READY = {
    query: [
        [ROOMS_FUNCTION_PRESENT, [{ to_regproc: "public.ensure_office_rooms" }]],
        [ENSURE_OFFICE_ROOMS, []],
        [MOVE_AGENT_HOME, [{ moved: true }]],
    ],
} as const

const invalid = { code: WorkspaceSeedErrorCode.InputInvalid }
const HAKUEN = "HAKUEN Hotel & Spa"
const command = { profile: "hakuen", owner: " Hakuen.Demo@gmail.com ", execute: false }

describe("WorkspaceProfileService", () => {
    describe("profileOperator refusals", () => {
        it("refuses an unknown profile", async () => {
            const { service } = await build(mockEntityManager(), ensureWireOf(HAKUEN, HAKUEN_OWNER))
            await expect(service.profileOperator({ ...command, profile: "nope" })).rejects.toMatchObject(invalid)
        })

        it("refuses a command without a profile or an owner", async () => {
            const { service } = await build(mockEntityManager(), ensureWireOf(HAKUEN, HAKUEN_OWNER))
            await expect(service.profileOperator({})).rejects.toMatchObject(invalid)
            await expect(service.profileOperator({ profile: "hakuen" })).rejects.toMatchObject(invalid)
        })

        it("refuses role input", async () => {
            const { service } = await build(mockEntityManager(), ROLE_WIRE)
            await expect(service.profileOperator(command)).rejects.toMatchObject(invalid)
        })

        it("refuses input naming another owner", async () => {
            const { service } = await build(mockEntityManager(), ensureWireOf(HAKUEN, "other@example.test"))
            await expect(service.profileOperator(command)).rejects.toMatchObject(invalid)
        })

        it("refuses a run without the private profile input", async () => {
            const { service } = await build(mockEntityManager(), ensureWireOf(HAKUEN, HAKUEN_OWNER), null)
            await expect(service.profileOperator(command)).rejects.toMatchObject({
                code: WorkspaceSeedErrorCode.InputRequired,
            })
        })

        it("refuses a profile input without the endpoint of a profile connector", async () => {
            const { service } = await build(mockEntityManager(), ensureWireOf(HAKUEN, HAKUEN_OWNER), {
                schema: "nivo/workspace-profile-input@1",
                connectors: { other: { url: CONNECTOR_URL } },
            })
            await expect(service.profileOperator(command)).rejects.toMatchObject(invalid)
        })

        it("refuses input naming another workspace", async () => {
            const { service, seeds } = await build(mockEntityManager(), ensureWireOf("Other", HAKUEN_OWNER))
            await expect(service.profileOperator(command)).rejects.toMatchObject(invalid)
            expect(seeds.seedOwned).not.toHaveBeenCalled()
        })
    })
})

describe("WorkspaceProfileService", () => {
    describe("profileOperator runs", () => {
        it("prints the plan of a dry run, absent execute included, and writes nothing", async () => {
            const { service, print, seeds } = await build(mockEntityManager(), ensureWireOf(HAKUEN, HAKUEN_OWNER))
            const plan = {
                schema: "nivo/workspace-profile@1",
                profile: "hakuen",
                executed: false,
                workspaceId: null,
                agents: 5,
                rules: HAKUEN_PROFILE.rules.length,
                toolGrants: HAKUEN_PROFILE.agents.reduce((count, agent) => count + agent.tools.length, 0),
                connectors: { hakuen: { tools: 0, approved: false } },
                documents: { inserted: HAKUEN_PROFILE.documents.length, requeued: 0, unchanged: 0 },
                installations: Object.fromEntries(HAKUEN_PROFILE.agents.map((agent) => [agent.handle, "planned"])),
                rooms: "planned",
            }

            await expect(service.profileOperator(command)).resolves.toEqual(plan)
            await expect(
                service.profileOperator({ profile: "hakuen", owner: "hakuen.demo@gmail.com" }),
            ).resolves.toEqual(plan)

            expect(seeds.seedOwned).not.toHaveBeenCalled()
            expect(print).toHaveBeenCalledWith(`${PROFILE_RECEIPT_PREFIX}${JSON.stringify(plan)}`)
        })

        it("ensures the workspace, then applies the profile as its owner and prints the receipt", async () => {
            const { service, print, seeds } = await build(mockEntityManager(), ensureWireOf(HAKUEN, HAKUEN_OWNER))
            seeds.seedOwned.mockResolvedValue(OWNED_SEED)
            const done: ProfileReport = {
                schema: "nivo/workspace-profile@1",
                profile: "hakuen",
                executed: true,
                workspaceId: WS,
                agents: 5,
                rules: 1,
                toolGrants: 0,
                connectors: { hakuen: { tools: 16, approved: false } },
                documents: { inserted: 1, requeued: 0, unchanged: 0 },
                installations: { "ai-ke-toan": "needs_connection" },
                rooms: "ready",
            }
            const apply = jest.spyOn(service, "apply").mockResolvedValue(done)

            await expect(service.profileOperator({ ...command, execute: true })).resolves.toBe(done)

            expect(seeds.seedOwned).toHaveBeenCalledWith(expect.objectContaining({ workspaceName: HAKUEN }))
            expect(apply).toHaveBeenCalledWith(TARGET, HAKUEN_PROFILE, [
                {
                    key: "hakuen",
                    name: "HAKUEN Back Office",
                    needsCredential: true,
                    contractVersion: "hakuen-mcp@1",
                    url: CONNECTOR_URL,
                },
            ])
            expect(print).toHaveBeenCalledWith(`${PROFILE_RECEIPT_PREFIX}${JSON.stringify(done)}`)
        })
    })
})

describe("WorkspaceProfileService", () => {
    describe("profiles without connectors", () => {
        it("plans a profile without connectors with no profile input at all", async () => {
            const get = jest.spyOn(WORKSPACE_PROFILES, "get").mockReturnValue({ ...EMPTY, workspaceName: HAKUEN })
            try {
                const { service } = await build(mockEntityManager(), ensureWireOf(HAKUEN, HAKUEN_OWNER), null)
                await expect(service.profileOperator(command)).resolves.toMatchObject({
                    connectors: {},
                    rooms: "planned",
                })
            } finally {
                get.mockRestore()
            }
        })
    })
})

describe("WorkspaceProfileService", () => {
    describe("apply registers connectors as the owner", () => {
        const viewOf = (key: string, approvedAt: string | null, approved: ReadonlyArray<boolean>) => ({
            key,
            status: "active",
            credentialState: "set",
            approvedAt,
            tools: approved.map((value) => ({ approved: value })),
        })

        it("registers each connector as the owner, never approves it and reports each pinned catalog, or none before its bearer", async () => {
            const owners = await build(mockEntityManager({ query: [ROOMS_FUNCTION_PRESENT, []] }))
            owners.toolGrants.upsert.mockResolvedValue(0)
            owners.connectors.connectors.mockResolvedValue([
                viewOf("remote-b", "2026-10-20T10:00:00.000Z", [true, true]),
                viewOf("remote-a", null, [false, false, false]),
                viewOf("remote-c", "2026-10-20T10:00:00.000Z", [true, false]),
                { ...viewOf("remote-d", null, []), status: "degraded", credentialState: "needed" },
            ])

            await expect(
                owners.service.apply(TARGET, EMPTY, [
                    CONNECTOR,
                    { ...CONNECTOR, key: "remote-b" },
                    { ...CONNECTOR, key: "remote-c" },
                    { ...CONNECTOR, key: "remote-d" },
                ]),
            ).resolves.toMatchObject({
                connectors: {
                    "remote-a": { tools: 3, approved: false },
                    "remote-b": { tools: 2, approved: true },
                    "remote-c": { tools: 2, approved: false },
                    "remote-d": { tools: 0, approved: false },
                },
            })

            expect(owners.connectors.registerRemote).toHaveBeenNthCalledWith(1, ACTOR, CONNECTOR)
            expect(owners.connectors.registerRemote).toHaveBeenCalledTimes(4)
            expect(owners.connectors.connectors).toHaveBeenCalledWith(ACTOR)
        })

        it.each([
            ["the server did not answer", [{ ...viewOf("remote-a", null, []), status: "degraded" }]],
            ["the connector is not listed", []],
        ])("fails the run before any grant when %s", async (_case, views) => {
            const owners = await build(mockEntityManager())
            owners.connectors.connectors.mockResolvedValue(views)

            await expect(owners.service.apply(TARGET, EMPTY, [CONNECTOR])).rejects.toMatchObject({
                code: WorkspaceSeedErrorCode.ConnectorUnreachable,
                params: { key: "remote-a" },
            })
            expect(owners.toolGrants.upsert).not.toHaveBeenCalled()
        })

        it("lists nothing when the profile has no connector", async () => {
            const owners = await build(mockEntityManager({ query: [ROOMS_FUNCTION_PRESENT, []] }))
            owners.toolGrants.upsert.mockResolvedValue(0)

            await expect(owners.service.apply(TARGET, EMPTY, [])).resolves.toMatchObject({ connectors: {} })
            expect(owners.connectors.connectors).not.toHaveBeenCalled()
        })
    })
})

describe("WorkspaceProfileService", () => {
    describe("apply through the owners", () => {
        it("brands as the owner, keeps the agents, writes the grants and documents, seats rooms and saves rules", async () => {
            const em = mockEntityManager(ROOMS_READY)
            const owners = await build(em)
            owners.agents.ensureByHandle.mockResolvedValueOnce("a1").mockResolvedValueOnce("a2")
            owners.toolGrants.upsert.mockResolvedValue(2)
            owners.sources.keep
                .mockResolvedValueOnce("inserted")
                .mockResolvedValueOnce("unchanged")
                .mockResolvedValueOnce("requeued")

            await expect(owners.service.apply(TARGET, PROFILE, [])).resolves.toEqual({
                schema: "nivo/workspace-profile@1",
                profile: "test",
                executed: true,
                workspaceId: WS,
                agents: 2,
                rules: 1,
                toolGrants: 2,
                connectors: {},
                documents: { inserted: 1, requeued: 1, unchanged: 1 },
                installations: { "ai-sales": "ready", "ai-cskh": "ready" },
                rooms: "ready",
            })

            expect(owners.workspaces.setBrand).toHaveBeenCalledWith(OWNER, WS, {
                displayName: "Test Brand",
                logoUrl: "/brand/test.jpg",
            })
            expect(owners.agents.ensureByHandle).toHaveBeenNthCalledWith(1, {
                workspaceId: WS,
                module: "chatbot",
                name: "ai-sales",
                handle: "ai-sales",
                role: "role",
                instructions: "instructions",
            })
            expect(owners.activation.install.mock.calls).toEqual([
                [WS, "a1", PROFILE.agents[0]],
                [WS, "a2", PROFILE.agents[1]],
            ])
            expect(owners.rules.save).toHaveBeenCalledWith(WS, PROFILE.rules[0])
            const answers = PROFILE.agents[0]?.setup
            expect(owners.activation.activate).toHaveBeenCalledWith(TARGET, [
                { handle: "ai-sales", installation: installationOf(), answers },
                { handle: "ai-cskh", installation: installationOf(), answers },
            ])
        })
    })
})

describe("WorkspaceProfileService", () => {
    describe("apply profile data", () => {
        it("passes argument bounds through as profile data and stamps documents with the profile origin", async () => {
            const owners = await build(mockEntityManager(ROOMS_READY))
            owners.agents.ensureByHandle.mockResolvedValue("a1")
            owners.sources.keep.mockResolvedValue("unchanged")

            await owners.service.apply(TARGET, { ...PROFILE, agents: [agentOf("ai-sales", "sales")] }, [])

            expect(owners.toolGrants.upsert).toHaveBeenCalledWith([
                { workspaceId: WS, agentId: "a1", tool: "hakuen.*", mode: "auto", limitVnd: null, constraints: [] },
                {
                    workspaceId: WS,
                    agentId: "a1",
                    tool: "hakuen.booking.confirm",
                    mode: "auto",
                    limitVnd: 5_000_000,
                    constraints: [{ arg: "nights", max: 3 }],
                },
            ])
            expect(owners.sources.keep).toHaveBeenCalledWith({
                workspaceId: WS,
                ownerId: OWNER,
                origin: "seed:test",
                title: "new",
                topic: "topic",
                module: null,
                visibility: "internal",
                content: "# new",
            })
        })

        it("seats only the agents with a home room after ensuring the rooms", async () => {
            const em = mockEntityManager(ROOMS_READY)
            const owners = await build(em)
            owners.agents.ensureByHandle.mockResolvedValueOnce("a1").mockResolvedValueOnce("a2")

            await owners.service.apply(TARGET, { ...PROFILE, documents: [] }, [])

            expect(em.query.mock.calls).toEqual([
                [ROOMS_FUNCTION_PRESENT, ["public.ensure_office_rooms"]],
                [ENSURE_OFFICE_ROOMS, [WS]],
                [MOVE_AGENT_HOME, [WS, "sales", "a1"]],
            ])
        })
    })
})

describe("WorkspaceProfileService", () => {
    describe("apply without the Hub rooms", () => {
        it("reports absent rooms and an empty grant set when the rooms function is missing", async () => {
            const em = mockEntityManager({ query: [ROOMS_FUNCTION_PRESENT, []] })
            const { service, toolGrants } = await build(em)
            toolGrants.upsert.mockResolvedValue(0)

            await expect(service.apply(TARGET, EMPTY, [])).resolves.toMatchObject({
                rooms: "absent",
                toolGrants: 0,
                documents: { inserted: 0, requeued: 0, unchanged: 0 },
            })
            expect(toolGrants.upsert).toHaveBeenCalledWith([])
            expect(em.query).toHaveBeenCalledTimes(1)
        })

        it("stops before any agent when the owner cannot brand the workspace", async () => {
            const { service, workspaces, agents, rules } = await build(mockEntityManager())
            const refusal = new Error("not found")
            workspaces.setBrand.mockRejectedValue(refusal)

            await expect(service.apply(TARGET, PROFILE, [])).rejects.toBe(refusal)
            expect(agents.ensureByHandle).not.toHaveBeenCalled()
            expect(rules.save).not.toHaveBeenCalled()
        })
    })
})

describe("WorkspaceProfileService", () => {
    describe("the HAKUEN playbooks reach the per-turn recall", () => {
        it("keeps the booking playbook as a public chatbot document of the workspace, with the step order and the hand-off", async () => {
            const owners = await build(mockEntityManager({ query: [ROOMS_FUNCTION_PRESENT, []] }))
            owners.agents.ensureByHandle.mockResolvedValue("a1")
            owners.toolGrants.upsert.mockResolvedValue(0)
            owners.sources.keep.mockResolvedValue("inserted")

            await expect(
                owners.service.apply(TARGET, { ...HAKUEN_PROFILE, connectors: [] }, []),
            ).resolves.toMatchObject({ documents: { inserted: HAKUEN_PROFILE.documents.length } })

            const kept = owners.sources.keep.mock.calls.map(([source]) => source)
            expect(kept).toHaveLength(HAKUEN_PROFILE.documents.length)
            const booking = kept.filter(
                (source) => source.module === "chatbot" && source.content.includes("hakuen.booking.confirm"),
            )
            expect(booking).toHaveLength(1)
            const [playbook] = booking
            expect(playbook).toMatchObject({
                workspaceId: WS,
                ownerId: OWNER,
                origin: "seed:hakuen",
                visibility: "public",
            })
            const steps = [
                "hakuen.rooms.searchAvailability",
                "hakuen.rates.quote",
                "hakuen.booking.hold",
                "hakuen.booking.confirm",
                "conversation.handOff",
            ].map((step) => playbook?.content.indexOf(step) ?? -1)
            expect(steps.every((at, index) => at >= 0 && (index === 0 || at > (steps[index - 1] ?? 0)))).toBe(true)
        })
    })
})
