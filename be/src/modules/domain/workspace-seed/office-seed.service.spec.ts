import { Test } from "@nestjs/testing"
import {
    OWNED_SEED,
    ROLE_WIRE,
    SEED_OWNER,
    SEED_WS,
    ensureWireOf,
} from "@tests/fixtures/builders/workspace-seed.builder"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentOwnershipService } from "@modules/domain/agents"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { OFFICE_RECEIPT_PREFIX } from "./messages/workspace-seed.messages"
import { SEED_OFFICE_AUTHORITY } from "./office-seed.decorators"
import type { OfficeAuthorityPort } from "./office-seed.port"
import { OfficeSeedService } from "./office-seed.service"
import { SEAT_PERSON } from "./persistence/office-seed.sql"
import { ENSURE_OFFICE_ROOMS, MOVE_AGENT_HOME, ROOMS_FUNCTION_PRESENT } from "./persistence/workspace-profile.sql"
import { HAKUEN_OFFICE } from "./profiles/hakuen-office.templates"
import { SEED_AGENTS, WORKSPACE_SEED_OPTIONS } from "./workspace-seed.decorators"
import type { SeedAgentRecords } from "./workspace-seed.port"
import { WorkspaceSeedService } from "./workspace-seed.service"

const WS = SEED_WS
const OWNER = SEED_OWNER
const NAM = "nam@example.test"
const INPUT = ensureWireOf(HAKUEN_OFFICE.workspaceName, NAM)
const OFFICE_WIRE = {
    schema: "nivo/workspace-office-input@1",
    people: {
        ha: { email: "ha@example.test", name: "Chi Ha", password: "ha-private" },
        van: { email: "van@example.test", name: "Van" },
    },
}
const USER_OF_EMAIL: Readonly<Record<string, string>> = {
    "manager@example.test": "user-minh",
    "staff@example.test": "user-lan",
    "ha@example.test": "user-ha",
    "van@example.test": "user-van",
}
const AGENT_OF_HANDLE: Readonly<Record<string, string>> = {
    "office-ai-sales": "agent-sales",
    "office-ke-toan-ai": "agent-accounting",
    "office-ai-cskh": "agent-care",
    "office-ai-marketing": "agent-marketing",
}
const MEMBER_OF_USER: Readonly<Record<string, string>> = {
    [OWNER]: "m-nam",
    "user-minh": "m-minh",
    "user-lan": "m-lan",
    "user-ha": "m-ha",
    "user-van": "m-van",
}
const ROOMS_READY = [
    [ROOMS_FUNCTION_PRESENT, [{ present: true }]],
    [ENSURE_OFFICE_ROOMS, []],
    [MOVE_AGENT_HOME, [{ moved: true }]],
    [SEAT_PERSON, [{ seated: true }]],
] as const

const secretOf = (value: unknown): Secret => new Secret(JSON.stringify(value))

interface BuildOptions {
    /** The private ensure input; the story's own by default. */
    readonly input?: unknown
    /** The private office input; the story's own by default. */
    readonly office?: unknown
}

/** The office seed with the authority capability behind its port. */
const build = async (em: MockEntityManager, options: BuildOptions = {}) => {
    const print = jest.fn()
    const seeds = mock<WorkspaceSeedService>()
    seeds.seedOwned.mockResolvedValue(OWNED_SEED)
    seeds.ensureSeat.mockImplementation((...[, , account]) =>
        Promise.resolve(USER_OF_EMAIL[account.email] ?? "unknown"),
    )
    const agents = mock<AgentOwnershipService>()
    agents.memberIdOf.mockImplementation((userId) => Promise.resolve(MEMBER_OF_USER[userId] ?? "unknown"))
    const records = mock<SeedAgentRecords>()
    records.ensureByHandle.mockImplementation((agent) => Promise.resolve(AGENT_OF_HANDLE[agent.handle] ?? "unknown"))
    const authority = mock<OfficeAuthorityPort>({ apply: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            OfficeSeedService,
            {
                provide: WORKSPACE_SEED_OPTIONS,
                useValue: {
                    auth: Symbol("auth"),
                    input: secretOf(options.input ?? INPUT),
                    officeInput: secretOf(options.office ?? OFFICE_WIRE),
                    print,
                },
            },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: SEED_AGENTS, useValue: records },
            { provide: SEED_OFFICE_AUTHORITY, useValue: authority },
            { provide: WorkspaceSeedService, useValue: seeds },
            { provide: AgentOwnershipService, useValue: agents },
        ],
    }).compile()
    return { service: moduleRef.get(OfficeSeedService), print, seeds, agents, records, authority }
}

describe("OfficeSeedService dry run", () => {
    it("validates the private input and prints the plan without writing anything", async () => {
        const em = mockEntityManager({ query: [ROOMS_FUNCTION_PRESENT, [{ present: true }]] })
        const { service, print, seeds, records, agents } = await build(em)

        const report = await service.officeOperator({ owner: ` ${NAM.toUpperCase()} ` })

        expect(report).toEqual({
            schema: "nivo/workspace-office@1",
            profile: "hakuen-office",
            executed: false,
            workspaceId: null,
            people: 5,
            agents: 4,
            ownership: 4,
            rooms: "planned",
            authority: "planned",
        })
        expect(print).toHaveBeenCalledWith(`${OFFICE_RECEIPT_PREFIX}${JSON.stringify(report)}`)
        expect(seeds.seedOwned).not.toHaveBeenCalled()
        expect(records.ensureByHandle).not.toHaveBeenCalled()
        expect(agents.setOwnership).not.toHaveBeenCalled()
        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("OfficeSeedService input checks", () => {
    it.each([
        { name: "another owner", command: { owner: "someone@example.test" }, change: {} },
        { name: "no owner", command: {}, change: {} },
        { name: "another workspace", command: { owner: NAM }, change: { input: ensureWireOf("Production", NAM) } },
        { name: "a role change input", command: { owner: NAM }, change: { input: ROLE_WIRE } },
        {
            name: "an office person who reuses an ensure email",
            command: { owner: NAM },
            change: {
                office: {
                    ...OFFICE_WIRE,
                    people: { ...OFFICE_WIRE.people, ha: { email: "staff@example.test", name: "Ha" } },
                },
            },
        },
    ])("refuses $name before writing", async ({ command, change }) => {
        const { service, seeds } = await build(mockEntityManager({}), change)

        await expect(service.officeOperator({ ...command, execute: true })).rejects.toMatchObject({
            code: WorkspaceSeedErrorCode.InputInvalid,
        })
        expect(seeds.seedOwned).not.toHaveBeenCalled()
    })

    it("refuses an office input that is not the story's", async () => {
        const { service } = await build(mockEntityManager({}), { office: { schema: "other@1" } })

        await expect(service.officeOperator({ owner: NAM })).rejects.toMatchObject({
            code: WorkspaceSeedErrorCode.InputInvalid,
        })
    })
})

describe("OfficeSeedService execute", () => {
    it("seats the five people and keeps the four agents in their rooms", async () => {
        const em = mockEntityManager({ query: ROOMS_READY })
        const { service, print, seeds, records } = await build(em)

        const report = await service.officeOperator({ owner: NAM, execute: true })

        expect(report).toEqual({
            schema: "nivo/workspace-office@1",
            profile: "hakuen-office",
            executed: true,
            workspaceId: WS,
            people: 5,
            agents: 4,
            ownership: 4,
            rooms: "ready",
            authority: "applied",
        })
        expect(print).toHaveBeenCalledWith(`${OFFICE_RECEIPT_PREFIX}${JSON.stringify(report)}`)
        expect(seeds.seedOwned).toHaveBeenCalledTimes(1)
        expect(seeds.ensureSeat.mock.calls.map(([, , , role]) => role)).toEqual([
            "manager",
            "manager",
            "staff",
            "staff",
        ])
        expect(seeds.ensureSeat).toHaveBeenCalledWith(
            OWNER,
            WS,
            expect.objectContaining({ email: "ha@example.test", name: "Chi Ha" }),
            "manager",
        )
        expect(records.ensureByHandle).toHaveBeenCalledTimes(4)
        expect(records.ensureByHandle).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: WS, module: "sales", name: "AI Sales", handle: "office-ai-sales" }),
        )
        expect(em.query).toHaveBeenCalledWith(ENSURE_OFFICE_ROOMS, [WS])
        expect(em.query).toHaveBeenCalledWith(MOVE_AGENT_HOME, [WS, "accounting", "agent-accounting"])
        expect(em.query).toHaveBeenCalledWith(SEAT_PERSON, [WS, "executive", OWNER])
        expect(em.query).toHaveBeenCalledWith(SEAT_PERSON, [WS, "sales", "user-lan"])
        expect(em.query).toHaveBeenCalledWith(SEAT_PERSON, [WS, "accounting", "user-van"])
    })
})

describe("OfficeSeedService ownership and rooms", () => {
    it("writes who answers for each agent, who may give it work and whom it may tag", async () => {
        const { service, agents } = await build(mockEntityManager({ query: ROOMS_READY }))

        await service.officeOperator({ owner: NAM, execute: true })

        expect(agents.setOwnership).toHaveBeenCalledTimes(4)
        expect(agents.setOwnership).toHaveBeenCalledWith(OWNER, WS, "agent-sales", {
            ownerMemberId: "m-minh",
            fallbackMemberId: "m-nam",
            assignableRoles: ["owner", "manager"],
            assignableRooms: ["sales"],
            canTagAgentIds: ["agent-accounting", "agent-care"],
        })
        expect(agents.setOwnership).toHaveBeenCalledWith(OWNER, WS, "agent-accounting", {
            ownerMemberId: "m-van",
            fallbackMemberId: "m-nam",
            assignableRoles: ["owner", "manager"],
            assignableRooms: ["accounting"],
            canTagAgentIds: ["agent-care"],
        })
        expect(agents.setOwnership).toHaveBeenCalledWith(
            OWNER,
            WS,
            "agent-care",
            expect.objectContaining({ ownerMemberId: "m-ha", canTagAgentIds: [] }),
        )
        expect(agents.setOwnership).toHaveBeenCalledWith(
            OWNER,
            WS,
            "agent-marketing",
            expect.objectContaining({ canTagAgentIds: ["agent-sales"] }),
        )
    })

    it("still writes the agents and their owners when the Hub rooms function is not installed", async () => {
        const em = mockEntityManager({ query: [ROOMS_FUNCTION_PRESENT, [{ present: false }]] })
        const { service, agents } = await build(em)

        await expect(service.officeOperator({ owner: NAM, execute: true })).resolves.toMatchObject({
            rooms: "absent",
            ownership: 4,
        })
        expect(agents.setOwnership).toHaveBeenCalledTimes(4)
        expect(em.query).toHaveBeenCalledTimes(1)
    })

    it("treats a missing answer of the rooms check as no rooms", async () => {
        const { service } = await build(mockEntityManager({ query: [ROOMS_FUNCTION_PRESENT, []] }))

        await expect(service.officeOperator({ owner: NAM, execute: true })).resolves.toMatchObject({ rooms: "absent" })
    })
})

describe("OfficeSeedService authority", () => {
    it("hands the rules and grants, resolved to ids, to the authority capability", async () => {
        const { service, authority } = await build(mockEntityManager({ query: ROOMS_READY }))

        await expect(service.officeOperator({ owner: NAM, execute: true })).resolves.toMatchObject({
            authority: "applied",
        })

        expect(authority.apply).toHaveBeenCalledTimes(1)
        expect(authority.apply).toHaveBeenCalledWith(
            WS,
            expect.objectContaining({
                rules: [
                    expect.objectContaining({
                        action: "give_discount",
                        unit: "percent",
                        auto_max: 3,
                        ask_max: 15,
                        approval_policy: "any",
                        timeout_minutes: 30,
                        agents: ["agent-sales"],
                        approver_group: { roles: ["manager"], rooms: ["sales"], members: [] },
                    }),
                    expect.objectContaining({
                        action: "issue_invoice",
                        agents: ["agent-accounting"],
                        approver_group: { roles: [], rooms: ["accounting"], members: ["m-van"] },
                        required_fields: ["customer", "amount_vnd", "tax_code"],
                    }),
                    expect.objectContaining({
                        action: "reply_customer",
                        department: "chatbot",
                        agents: ["agent-care"],
                    }),
                ],
                grants: expect.arrayContaining([
                    { member_id: "m-minh", action: "give_discount", unit: "percent", limit: 15 },
                    { member_id: "m-ha", action: "give_discount", unit: "percent", limit: 10 },
                ]),
            }),
        )
    })
})
