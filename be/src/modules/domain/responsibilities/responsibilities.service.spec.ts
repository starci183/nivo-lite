import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import type { MockEntityManager } from "@starci/jest-preset"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { AGENT_DIRECTORY } from "@modules/domain/messages"
import type { AgentDirectory } from "@modules/domain/messages"
import { EventsService } from "@modules/domain/events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG, REQUEST_LOCALE } from "@modules/platform/i18n"
import type { MessageCatalog, RequestLocale } from "@modules/platform/i18n"
import { ResponsibilitiesError, ResponsibilitiesErrorCode } from "./errors/responsibilities.error"
import { ResponsibilityEntity } from "./persistence/entities"
import type { AddResponsibilityParams, AssignResponsibilityParams } from "./responsibilities.contracts"
import { ResponsibilitiesService } from "./responsibilities.service"
import type { ResolvedOwner } from "./responsibility-owner.policy"
import { RESPONSIBILITY_LEAD_DESK } from "./responsibilities.decorators"
import type { LeadDesk } from "./responsibilities.port"
import { ResponsibilityOwnersService } from "./responsibility-owners.service"

const MEMBER_ID = "11111111-1111-4111-8111-111111111111"
const AGENT_ID = "22222222-2222-4222-8222-222222222222"

const MEMBER_OWNER: ResolvedOwner = { kind: "human", agentId: null, memberId: MEMBER_ID, name: "Anh Minh" }
const AGENT_OWNER: ResolvedOwner = { kind: "agent", agentId: AGENT_ID, memberId: null, name: "Sales AI" }

const addOf = builder<AddResponsibilityParams>({
    workspaceId: "ws-1",
    leadId: "lead-1",
    title: "Send the contract",
    owner: MEMBER_ID,
    nextAction: "Email the contract",
    dueAt: "2026-10-20T00:00:00.000Z",
    userId: "user-1",
    acceptLanguage: "en",
})

const assignOf = builder<AssignResponsibilityParams>({
    workspaceId: "ws-1",
    responsibilityId: "step-1",
    owner: MEMBER_ID,
    nextAction: "Call back",
    dueAt: null,
    title: null,
    userId: "user-1",
    acceptLanguage: "en",
})

const STEP = {
    id: "step-1",
    lead_id: "lead-1",
    title: "Send the contract",
    owner_kind: "human",
    owner_agent_id: null,
    owner_member_id: MEMBER_ID,
    owner_name: "Anh Minh",
    next_action: "Email the contract",
    due_at: "2026-10-20T00:00:00.000Z",
    status: "open",
}

const RESULT = {
    id: "step-1",
    leadId: "lead-1",
    title: "Send the contract",
    ownerKind: "human",
    ownerAgentId: null,
    ownerMemberId: MEMBER_ID,
    ownerName: "Anh Minh",
    nextAction: "Email the contract",
    dueAt: "2026-10-20T00:00:00.000Z",
    status: "open",
}

/** What the neighbours answer: whether the lead guard finds the lead, and the active Accounting agent of the directory, if any. */
interface World {
    readonly leadHeld?: boolean
    readonly accountingAgent?: { readonly id: string; readonly name: string } | null
}

const build = async (
    entityManager: MockEntityManager,
    owner: ResolvedOwner | Error = MEMBER_OWNER,
    world: World = {},
) => {
    const messages = mock<MessageCatalog>()
    messages.get.mockImplementation((key, params) => `${key}:${JSON.stringify(params)}`)
    const requestLocale = mock<RequestLocale>()
    requestLocale.of.mockReturnValue("en")
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "owner",
        staffId: null,
        displayName: "Linh",
        status: "active",
    })
    const events = mock<EventsService>()
    events.record.mockResolvedValue(undefined)
    const owners = mock<ResponsibilityOwnersService>()
    if (owner instanceof Error) owners.resolve.mockRejectedValue(owner)
    else owners.resolve.mockResolvedValue(owner)
    const agents = mock<AgentDirectory>()
    agents.agentOfDepartment.mockImplementation(() => Promise.resolve(world.accountingAgent ?? null))
    const leads = mock<LeadDesk>()
    leads.hold.mockImplementation(() => Promise.resolve(world.leadHeld ?? true))
    const moduleRef = await Test.createTestingModule({
        providers: [
            ResponsibilitiesService,
            { provide: AGENT_DIRECTORY, useValue: agents },
            { provide: RESPONSIBILITY_LEAD_DESK, useValue: leads },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: messages },
            { provide: REQUEST_LOCALE, useValue: requestLocale },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T03:00:00.000Z") },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EventsService, useValue: events },
            { provide: ResponsibilityOwnersService, useValue: owners },
        ],
    }).compile()
    return { responsibilities: moduleRef.get(ResponsibilitiesService), events, requestLocale, owners, agents, leads }
}

const NEW_STEP = {
    workspaceId: "ws-1",
    leadId: "lead-1",
    title: "Send the contract",
    ownerKind: "human",
    ownerAgentId: null,
    ownerName: "Anh Minh",
    nextAction: "Email the contract",
    dueAt: new Date("2026-10-20T00:00:00.000Z"),
    ownerMemberId: MEMBER_ID,
}

/** Answers the insert with `inserted`. */
const answerInsert = (em: MockEntityManager, inserted: ReadonlyArray<unknown>) => {
    const write = fakeQueryBuilder({ execute: { raw: inserted } })
    answerQueryBuilders(em, write)
    return { write }
}

describe("ResponsibilitiesService > addResponsibility", () => {
    it("writes the step owned by the member and logs who owns it in the same transaction", async () => {
        const em = mockEntityManager()
        const { write } = answerInsert(em, [STEP])
        const tx = fakeTransaction(em)
        const { responsibilities, events, owners, leads } = await build(tx.em)

        await expect(responsibilities.addResponsibility(addOf())).resolves.toEqual(RESULT)

        expect(owners.resolve.mock.calls).toEqual([["ws-1", MEMBER_ID]])
        expect(leads.hold).toHaveBeenCalledWith("ws-1", "lead-1", expect.anything())
        expect(isTransactionManager(leads.hold.mock.calls[0]?.[2])).toBe(true)
        expect(em.createQueryBuilder).toHaveBeenCalledWith(ResponsibilityEntity, "r")
        expect(write.callsOf("insert")).toEqual([[]])
        expect(write.argsOf("values")).toEqual([[NEW_STEP]])
        expect(write.argsOf("returning")).toEqual([[expect.stringContaining("to_char(due_at AT TIME ZONE 'UTC'")]])
        expect(events.record.mock.calls[0]?.[0]).toEqual({
            workspaceId: "ws-1",
            leadId: "lead-1",
            kind: "responsibility.assigned",
            actor: "Linh",
            summary: 'responsibilities.owner-next:{"owner":"Anh Minh","next":"Email the contract"}',
        })
        expect(isTransactionManager(events.record.mock.calls[0]?.[1])).toBe(true)
        expect(tx.commits).toBe(1)
    })

    it("writes the step owned by an agent of the workspace, with no member", async () => {
        const agentStep = { ...STEP, owner_kind: "agent", owner_agent_id: AGENT_ID, owner_member_id: null }
        const em = mockEntityManager()
        const { write } = answerInsert(em, [agentStep])
        const tx = fakeTransaction(em)
        const { responsibilities } = await build(tx.em, AGENT_OWNER)

        await expect(responsibilities.addResponsibility(addOf({ owner: AGENT_ID }))).resolves.toMatchObject({
            ownerKind: "agent",
            ownerAgentId: AGENT_ID,
            ownerMemberId: null,
        })

        expect(write.argsOf("values")).toEqual([
            [{ ...NEW_STEP, ownerKind: "agent", ownerAgentId: AGENT_ID, ownerName: "Sales AI", ownerMemberId: null }],
        ])
    })
})

describe("ResponsibilitiesService > addResponsibility without a due date", () => {
    it("writes the step with no due date when none is given", async () => {
        const em = mockEntityManager()
        const { write } = answerInsert(em, [{ ...STEP, due_at: null }])
        const tx = fakeTransaction(em)
        const { responsibilities } = await build(tx.em)

        await expect(responsibilities.addResponsibility(addOf({ dueAt: null }))).resolves.toEqual({
            ...RESULT,
            dueAt: null,
        })

        expect(write.argsOf("values")).toEqual([[{ ...NEW_STEP, dueAt: null }]])
    })
})

describe("ResponsibilitiesService > addResponsibility, refusals", () => {
    it("refuses an owner that is neither a member nor an agent and writes nothing", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const refusal = new ResponsibilitiesError({ code: ResponsibilitiesErrorCode.OwnerNotFound })
        const { responsibilities, events } = await build(tx.em, refusal)

        await expect(responsibilities.addResponsibility(addOf({ owner: "human" }))).rejects.toBe(refusal)

        expect(tx.em.createQueryBuilder).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })

    it("refuses a lead the workspace does not have and inserts nothing", async () => {
        const em = mockEntityManager()
        const { write } = answerInsert(em, [])
        const tx = fakeTransaction(em)
        const { responsibilities, events } = await build(tx.em, MEMBER_OWNER, { leadHeld: false })

        await expect(responsibilities.addResponsibility(addOf())).rejects.toMatchObject({
            code: ResponsibilitiesErrorCode.LeadNotFound,
            params: { id: "lead-1" },
        })

        expect(write.argsOf("values")).toEqual([])
        expect(events.record).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })
})

describe("ResponsibilitiesService > due dates", () => {
    it("writes a step without a due date as none", async () => {
        const em = mockEntityManager()
        const { write } = answerInsert(em, [{ ...STEP, due_at: null }])
        const { responsibilities } = await build(fakeTransaction(em).em)

        await expect(responsibilities.addResponsibility(addOf({ dueAt: null }))).resolves.toMatchObject({ dueAt: null })
        expect(write.argsOf("values")).toEqual([[expect.objectContaining({ dueAt: null })]])
    })

    it("reschedules a step to the due date it is handed", async () => {
        const em = mockEntityManager()
        const update = fakeQueryBuilder({ execute: { raw: [STEP] } })
        answerQueryBuilders(em, update)
        const { responsibilities } = await build(fakeTransaction(em).em)

        await responsibilities.assignResponsibility(assignOf({ dueAt: "2026-10-20T00:00:00.000Z" }))

        expect(update.argsOf("set")).toEqual([
            [expect.objectContaining({ dueAt: new Date("2026-10-20T00:00:00.000Z") })],
        ])
    })
})

describe("ResponsibilitiesService > assignResponsibility", () => {
    it("changes the step to a member and logs who owns it", async () => {
        const changed = { ...STEP, next_action: "Call back", due_at: null }
        const em = mockEntityManager()
        const update = fakeQueryBuilder({ execute: { raw: [changed] } })
        answerQueryBuilders(em, update)
        const tx = fakeTransaction(em)
        const { responsibilities, events } = await build(tx.em)

        await expect(responsibilities.assignResponsibility(assignOf())).resolves.toMatchObject({
            id: "step-1",
            nextAction: "Call back",
            dueAt: null,
            ownerMemberId: MEMBER_ID,
        })

        expect(em.createQueryBuilder).toHaveBeenCalledWith(ResponsibilityEntity, "r")

        expect(update.callsOf("update")).toEqual([[]])
        expect(update.argsOf("set")).toEqual([
            [
                {
                    ownerKind: "human",
                    ownerAgentId: null,
                    ownerName: "Anh Minh",
                    nextAction: "Call back",
                    dueAt: null,
                    ownerMemberId: MEMBER_ID,
                },
            ],
        ])
        expect(update.argsOf("where")).toEqual([[{ workspaceId: "ws-1", id: "step-1" }]])
        expect(events.record.mock.calls[0]?.[0]).toMatchObject({
            leadId: "lead-1",
            summary: 'responsibilities.owner-next:{"owner":"Anh Minh","next":"Call back"}',
        })
        expect(isTransactionManager(events.record.mock.calls[0]?.[1])).toBe(true)
    })

    it("changes the step to an agent and renames it when a title is given", async () => {
        const agentStep = { ...STEP, owner_kind: "agent", owner_agent_id: AGENT_ID, owner_member_id: null }
        const em = mockEntityManager()
        const update = fakeQueryBuilder({ execute: { raw: [agentStep] } })
        answerQueryBuilders(em, update)
        const tx = fakeTransaction(em)
        const { responsibilities } = await build(tx.em, AGENT_OWNER)

        await responsibilities.assignResponsibility(assignOf({ owner: AGENT_ID, title: "Renewal" }))

        expect(update.argsOf("set")).toEqual([
            [
                {
                    ownerKind: "agent",
                    ownerAgentId: AGENT_ID,
                    ownerName: "Sales AI",
                    nextAction: "Call back",
                    dueAt: null,
                    ownerMemberId: null,
                    title: "Renewal",
                },
            ],
        ])
    })
})

describe("ResponsibilitiesService > assignResponsibility with a due date", () => {
    it("moves the step to the given due date", async () => {
        const em = mockEntityManager()
        const update = fakeQueryBuilder({ execute: { raw: [STEP] } })
        answerQueryBuilders(em, update)
        const tx = fakeTransaction(em)
        const { responsibilities } = await build(tx.em)

        await responsibilities.assignResponsibility(assignOf({ dueAt: "2026-10-25T00:00:00.000Z" }))

        expect(update.argsOf("set")).toEqual([
            [
                {
                    ownerKind: "human",
                    ownerAgentId: null,
                    ownerName: "Anh Minh",
                    nextAction: "Call back",
                    dueAt: new Date("2026-10-25T00:00:00.000Z"),
                    ownerMemberId: MEMBER_ID,
                },
            ],
        ])
    })
})

describe("ResponsibilitiesService > assignResponsibility, refusals", () => {
    it("refuses a step the workspace does not have", async () => {
        const em = mockEntityManager()
        answerQueryBuilders(em, fakeQueryBuilder({ execute: { raw: [] } }))
        const tx = fakeTransaction(em)
        const { responsibilities, events } = await build(tx.em)

        await expect(responsibilities.assignResponsibility(assignOf())).rejects.toMatchObject({
            code: ResponsibilitiesErrorCode.NotFound,
            params: { id: "step-1" },
        })

        expect(events.record).not.toHaveBeenCalled()
    })

    it("refuses an owner that is neither a member nor an agent before changing the step", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const refusal = new ResponsibilitiesError({ code: ResponsibilitiesErrorCode.OwnerNotFound })
        const { responsibilities } = await build(tx.em, refusal)

        await expect(responsibilities.assignResponsibility(assignOf({ owner: AGENT_ID }))).rejects.toBe(refusal)

        expect(tx.em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

const ACCOUNTING_AGENT = { id: "agent-9", name: "Accounting AI" }

describe("ResponsibilitiesService > handToAccounting", () => {
    const handOf = (manager: MockEntityManager) => ({
        workspaceId: "ws-1",
        leadId: "lead-1",
        contactName: "Anh Minh",
        locale: "en" as const,
        manager,
    })

    it("hands the deal to the active Accounting agent as a step due the next day and logs it", async () => {
        const manager = mockEntityManager()
        const { write } = answerInsert(manager, [])
        const { responsibilities, events, agents, leads } = await build(manager, MEMBER_OWNER, {
            accountingAgent: ACCOUNTING_AGENT,
        })

        await expect(responsibilities.handToAccounting(handOf(manager))).resolves.toBe(true)

        expect(agents.agentOfDepartment).toHaveBeenCalledWith("ws-1", "accounting", null)
        expect(leads.hold).toHaveBeenCalledWith("ws-1", "lead-1", manager)
        expect(write.argsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    leadId: "lead-1",
                    title: 'responsibilities.invoice-title:{"name":"Anh Minh"}',
                    ownerKind: "agent",
                    ownerAgentId: "agent-9",
                    ownerName: "Accounting AI",
                    nextAction: "responsibilities.invoice-next:{}",
                    dueAt: new Date("2026-10-13T03:00:00.000Z"),
                    ownerMemberId: null,
                },
            ],
        ])
        expect(events.record.mock.calls[0]?.[0]).toEqual({
            workspaceId: "ws-1",
            leadId: "lead-1",
            kind: "responsibility.assigned",
            actor: "Sales Agent",
            summary: 'responsibilities.handed-event:{"agent":"Accounting AI"}',
        })
    })

    it("writes nothing when the workspace has no active Accounting agent", async () => {
        const manager = mockEntityManager()
        const { responsibilities, events, leads } = await build(manager)

        await expect(responsibilities.handToAccounting(handOf(manager))).resolves.toBe(false)

        expect(leads.hold).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })

    it("writes no step but still records the hand-over when the lead is gone", async () => {
        const manager = mockEntityManager()
        const { write } = answerInsert(manager, [])
        const { responsibilities, events } = await build(manager, MEMBER_OWNER, {
            accountingAgent: ACCOUNTING_AGENT,
            leadHeld: false,
        })

        await expect(responsibilities.handToAccounting(handOf(manager))).resolves.toBe(true)

        expect(write.argsOf("values")).toEqual([])
        expect(events.record).toHaveBeenCalledTimes(1)
    })
})
