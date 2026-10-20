import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { PROFILE_RECEIPT_PREFIX } from "./messages/workspace-seed.messages"
import {
    ENSURE_AGENT_INSTALLATION,
    ENSURE_OFFICE_ROOMS,
    FIND_PROFILE_SOURCE,
    INSERT_PROFILE_SOURCE,
    MOVE_AGENT_HOME,
    REQUEUE_PROFILE_SOURCE,
    ROOMS_FUNCTION_PRESENT,
    SET_WORKSPACE_BRAND,
    TOOL_GRANTS_PRESENT,
    UPSERT_PROFILE_AGENT,
    UPSERT_TOOL_GRANT,
} from "./persistence/workspace-profile.sql"
import { HAKUEN_PROFILE } from "./profiles/hakuen.profile"
import type { ProfileAgent, ProfileDocument, WorkspaceProfile } from "./workspace-profile.contracts"
import { WorkspaceProfileService } from "./workspace-profile.service"
import { WORKSPACE_SEED_OPTIONS } from "./workspace-seed.decorators"
import { WorkspaceSeedService } from "./workspace-seed.service"

const WS = "11111111-1111-4111-8111-111111111111"
const OWNER = "22222222-2222-4222-8222-222222222222"
const AT = "2026-10-20T08:00:00.000Z"
const account = (email: string) => ({ email, name: email.slice(0, email.indexOf("@")), password: "private" })
const ensureWire = (workspaceName: string, owner = "hakuen.demo@gmail.com") => ({
    schema: "starci/app-workspace-input@1",
    action: "ensure",
    workspaceName,
    owner: account(owner),
    manager: account("manager@example.test"),
    staff: account("staff@example.test"),
})
const roleWire = {
    schema: "starci/app-workspace-input@1",
    action: "role",
    workspaceId: WS,
    memberId: OWNER,
    role: "staff",
    principalToken: "token",
}
const seeded = {
    schema: "starci/app-workspace-access@1" as const,
    ok: true as const,
    action: "ensure" as const,
    workspaceId: WS,
    publicReadback: true as const,
    consumerVerified: false as const,
    authentication: "password-session" as const,
    sessionCleanup: "acknowledged" as const,
}
const agentOf = (handle: string, room: string | null): ProfileAgent => ({
    module: "chatbot",
    name: handle,
    handle,
    role: "role",
    instructions: "instructions",
    room,
    tools: room === null ? [] : [{ tool: "hakuen.*", mode: "auto", limitVnd: null, limitPct: 0 }],
})
const documentOf = (title: string, content: string): ProfileDocument => ({
    title,
    topic: "topic",
    module: null,
    visibility: "internal",
    content,
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
    documents: [documentOf("new", "a"), documentOf("same", "b"), documentOf("changed", "c")],
}

const build = async (em: MockEntityManager, input?: unknown) => {
    const print = jest.fn()
    const seeds = mock<WorkspaceSeedService>()
    const rules = mock<AuthorityRulesService>()
    const queue = mock<KnowledgeQueue>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceProfileService,
            {
                provide: WORKSPACE_SEED_OPTIONS,
                useValue: {
                    auth: Symbol("auth"),
                    input: input === undefined ? undefined : new Secret(JSON.stringify(input)),
                    print,
                },
            },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: WorkspaceSeedService, useValue: seeds },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: KnowledgeQueue, useValue: queue },
        ],
    }).compile()
    return { service: moduleRef.get(WorkspaceProfileService), print, seeds, rules, queue }
}

const invalid = { code: WorkspaceSeedErrorCode.InputInvalid }

describe("WorkspaceProfileService.profileOperator", () => {
    const command = { profile: "hakuen", owner: " Hakuen.Demo@gmail.com ", execute: false }

    it("refuses an unknown profile", async () => {
        const { service } = await build(mockEntityManager(), ensureWire("HAKUEN Hotel & Spa"))
        await expect(service.profileOperator({ ...command, profile: "nope" })).rejects.toMatchObject(invalid)
    })

    it("refuses role input", async () => {
        const { service } = await build(mockEntityManager(), roleWire)
        await expect(service.profileOperator(command)).rejects.toMatchObject(invalid)
    })

    it("refuses input naming another owner", async () => {
        const { service } = await build(mockEntityManager(), ensureWire("HAKUEN Hotel & Spa", "other@example.test"))
        await expect(service.profileOperator(command)).rejects.toMatchObject(invalid)
    })

    it("refuses input naming another workspace", async () => {
        const { service, seeds } = await build(mockEntityManager(), ensureWire("Other"))
        await expect(service.profileOperator(command)).rejects.toMatchObject(invalid)
        expect(seeds.seed).not.toHaveBeenCalled()
    })

    it("prints the plan of a dry run and writes nothing", async () => {
        const { service, print, seeds } = await build(mockEntityManager(), ensureWire("HAKUEN Hotel & Spa"))
        const plan = {
            schema: "nivo/workspace-profile@1",
            profile: "hakuen",
            executed: false,
            workspaceId: null,
            agents: 5,
            rules: HAKUEN_PROFILE.rules.length,
            toolGrants: HAKUEN_PROFILE.agents.reduce((count, agent) => count + agent.tools.length, 0),
            documents: { inserted: HAKUEN_PROFILE.documents.length, requeued: 0, unchanged: 0 },
            rooms: "planned",
        }

        await expect(service.profileOperator(command)).resolves.toEqual(plan)

        expect(seeds.seed).not.toHaveBeenCalled()
        expect(print).toHaveBeenCalledWith(`${PROFILE_RECEIPT_PREFIX}${JSON.stringify(plan)}`)
    })

    it("ensures the workspace, then applies the profile to it and prints the receipt", async () => {
        const { service, print, seeds } = await build(mockEntityManager(), ensureWire("HAKUEN Hotel & Spa"))
        seeds.seed.mockResolvedValue(seeded)
        const done = {
            schema: "nivo/workspace-profile@1" as const,
            profile: "hakuen",
            executed: true,
            workspaceId: WS,
            agents: 5,
            rules: 1,
            toolGrants: 0,
            documents: { inserted: 1, requeued: 0, unchanged: 0 },
            rooms: "ready" as const,
        }
        const apply = jest.spyOn(service, "apply").mockResolvedValue(done)

        await expect(service.profileOperator({ ...command, execute: true })).resolves.toBe(done)

        expect(seeds.seed).toHaveBeenCalledWith(expect.objectContaining({ workspaceName: "HAKUEN Hotel & Spa" }))
        expect(apply).toHaveBeenCalledWith(WS, HAKUEN_PROFILE)
        expect(print).toHaveBeenCalledWith(`${PROFILE_RECEIPT_PREFIX}${JSON.stringify(done)}`)
    })
})

describe("WorkspaceProfileService.apply", () => {
    it("brands, ensures agents, loads documents, seats rooms and saves grants", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [SET_WORKSPACE_BRAND, [{ owner_id: OWNER }]],
                    [TOOL_GRANTS_PRESENT, [{ present: true }]],
                    [UPSERT_PROFILE_AGENT, [{ id: "a1" }]],
                    [ENSURE_AGENT_INSTALLATION, []],
                    [UPSERT_TOOL_GRANT, []],
                    [UPSERT_PROFILE_AGENT, [{ id: "a2" }]],
                    [ENSURE_AGENT_INSTALLATION, []],
                    [FIND_PROFILE_SOURCE, []],
                    [INSERT_PROFILE_SOURCE, [{ id: "s1" }]],
                    [FIND_PROFILE_SOURCE, [{ id: "s2", content: "b" }]],
                    [FIND_PROFILE_SOURCE, [{ id: "s3", content: "old" }]],
                    [REQUEUE_PROFILE_SOURCE, []],
                    [ROOMS_FUNCTION_PRESENT, [{ present: true }]],
                    [ENSURE_OFFICE_ROOMS, []],
                    [MOVE_AGENT_HOME, []],
                ],
            }),
        )
        const { service, rules, queue } = await build(tx.em)

        await expect(service.apply(WS, PROFILE)).resolves.toEqual({
            schema: "nivo/workspace-profile@1",
            profile: "test",
            executed: true,
            workspaceId: WS,
            agents: 2,
            rules: 1,
            toolGrants: 1,
            documents: { inserted: 1, requeued: 1, unchanged: 1 },
            rooms: "ready",
        })

        expect(tx.em.query).toHaveBeenCalledWith(SET_WORKSPACE_BRAND, [WS, "Test Brand", "/brand/test.jpg"])
        expect(tx.em.query).toHaveBeenCalledWith(ENSURE_AGENT_INSTALLATION, [WS, "chatbot", "ai-sales", "a1"])
        expect(tx.em.query).toHaveBeenCalledWith(INSERT_PROFILE_SOURCE, [
            WS,
            null,
            "topic",
            "internal",
            "new",
            "a",
            "seed:test",
            OWNER,
        ])
        expect(tx.em.query).toHaveBeenCalledWith(REQUEUE_PROFILE_SOURCE, ["s3", WS, "c", null, "topic", "internal"])
        expect(tx.em.query).toHaveBeenCalledWith(UPSERT_TOOL_GRANT, [WS, "a1", "hakuen.*", "auto", null, 0])
        expect(tx.em.query).toHaveBeenCalledWith(MOVE_AGENT_HOME, [WS, "sales", "a1"])
        expect(queue.enqueueIndex).toHaveBeenCalledWith({ sourceId: "s1", workspaceId: WS }, tx.em)
        expect(queue.enqueueIndex).toHaveBeenCalledWith({ sourceId: "s3", workspaceId: WS }, tx.em, Date.parse(AT))
        expect(queue.enqueueIndex).toHaveBeenCalledTimes(2)
        expect(rules.save).toHaveBeenCalledWith(WS, PROFILE.rules[0])
    })

    it("reports absent rooms when the Hub rooms function is not installed", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [SET_WORKSPACE_BRAND, [{ owner_id: OWNER }]],
                    [TOOL_GRANTS_PRESENT, []],
                    [ROOMS_FUNCTION_PRESENT, []],
                ],
            }),
        )
        const { service } = await build(tx.em)

        await expect(service.apply(WS, { ...PROFILE, agents: [], documents: [], rules: [] })).resolves.toMatchObject({
            rooms: "absent",
            toolGrants: "absent",
            documents: { inserted: 0, requeued: 0, unchanged: 0 },
        })
    })

    it("refuses a workspace that does not exist", async () => {
        const tx = fakeTransaction(mockEntityManager({ query: [SET_WORKSPACE_BRAND, []] }))
        const { service, rules } = await build(tx.em)

        await expect(service.apply(WS, PROFILE)).rejects.toMatchObject({ code: WorkspaceSeedErrorCode.RowMissing })
        expect(rules.save).not.toHaveBeenCalled()
    })

    it("refuses an agent write that answers no row", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [SET_WORKSPACE_BRAND, [{ owner_id: OWNER }]],
                    [TOOL_GRANTS_PRESENT, [{ present: false }]],
                    [UPSERT_PROFILE_AGENT, []],
                ],
            }),
        )
        const { service } = await build(tx.em)

        await expect(service.apply(WS, PROFILE)).rejects.toMatchObject({ code: WorkspaceSeedErrorCode.RowMissing })
    })

    it("refuses a document insert that answers no row", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [SET_WORKSPACE_BRAND, [{ owner_id: OWNER }]],
                    [TOOL_GRANTS_PRESENT, [{ present: false }]],
                    [FIND_PROFILE_SOURCE, []],
                    [INSERT_PROFILE_SOURCE, []],
                ],
            }),
        )
        const { service, queue } = await build(tx.em)

        await expect(service.apply(WS, { ...PROFILE, agents: [] })).rejects.toMatchObject({
            code: WorkspaceSeedErrorCode.RowMissing,
        })
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
    })
})
