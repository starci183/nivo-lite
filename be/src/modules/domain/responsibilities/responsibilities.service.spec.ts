import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import type { MockEntityManager } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG, REQUEST_LOCALE } from "@modules/platform/i18n"
import type { MessageCatalog, RequestLocale } from "@modules/platform/i18n"
import { ResponsibilitiesErrorCode } from "./errors/responsibilities.error"
import {
    FIND_ACCOUNTING_AGENT,
    FIND_AGENT,
    INSERT_RESPONSIBILITY,
    UPDATE_RESPONSIBILITY,
} from "./persistence/responsibilities.sql"
import type { AddResponsibilityParams, AssignResponsibilityParams } from "./responsibilities.contracts"
import { ResponsibilitiesService } from "./responsibilities.service"

const addOf = builder<AddResponsibilityParams>({
    workspaceId: "ws-1",
    leadId: "lead-1",
    title: "Send the contract",
    owner: "human",
    nextAction: "Email the contract",
    dueAt: "2026-10-20T00:00:00.000Z",
    userId: "user-1",
    acceptLanguage: "en",
})

const assignOf = builder<AssignResponsibilityParams>({
    workspaceId: "ws-1",
    responsibilityId: "step-1",
    owner: "human",
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
    owner_name: "Linh",
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
    ownerName: "Linh",
    nextAction: "Email the contract",
    dueAt: "2026-10-20T00:00:00.000Z",
    status: "open",
}

const build = async (entityManager: MockEntityManager) => {
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
    const moduleRef = await Test.createTestingModule({
        providers: [
            ResponsibilitiesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: messages },
            { provide: REQUEST_LOCALE, useValue: requestLocale },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T03:00:00.000Z") },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EventsService, useValue: events },
        ],
    }).compile()
    return { members, responsibilities: moduleRef.get(ResponsibilitiesService), events, requestLocale }
}

describe("ResponsibilitiesService", () => {
    describe("addResponsibility", () => {
        it("writes the step owned by the signed-in person and logs who owns it in the same transaction", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_RESPONSIBILITY, [STEP]] }))
            const { responsibilities, events, requestLocale } = await build(tx.em)

            await expect(responsibilities.addResponsibility(addOf())).resolves.toEqual(RESULT)

            expect(tx.em.query).toHaveBeenCalledWith(INSERT_RESPONSIBILITY, [
                "ws-1",
                "lead-1",
                "Send the contract",
                "human",
                null,
                "Linh",
                "Email the contract",
                "2026-10-20T00:00:00.000Z",
            ])
            expect(requestLocale.of).toHaveBeenCalledWith("en")
            expect(events.record).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    leadId: "lead-1",
                    kind: "responsibility.assigned",
                    actor: "Linh",
                    summary: 'responsibilities.owner-next:{"owner":"Linh","next":"Email the contract"}',
                },
                expect.anything(),
            )
            expect(isTransactionManager(events.record.mock.calls[0]?.[1])).toBe(true)
            expect(tx.commits).toBe(1)
        })

        it("writes the step owned by an agent of the workspace", async () => {
            const agentStep = { ...STEP, owner_kind: "agent", owner_agent_id: "agent-1", owner_name: "Sales AI" }
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [FIND_AGENT, [{ id: "agent-1", name: "Sales AI" }]],
                        [INSERT_RESPONSIBILITY, [agentStep]],
                    ],
                }),
            )
            const { responsibilities } = await build(tx.em)

            await expect(responsibilities.addResponsibility(addOf({ owner: "agent-1" }))).resolves.toMatchObject({
                ownerKind: "agent",
                ownerAgentId: "agent-1",
                ownerName: "Sales AI",
            })

            expect(tx.em.query).toHaveBeenNthCalledWith(1, FIND_AGENT, ["ws-1", "agent-1"])
        })

        it("refuses an owner that is not an agent of the workspace and writes nothing", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [FIND_AGENT, []] }))
            const { responsibilities, events } = await build(tx.em)

            await expect(responsibilities.addResponsibility(addOf({ owner: "agent-9" }))).rejects.toMatchObject({
                code: ResponsibilitiesErrorCode.AgentNotFound,
            })

            expect(tx.em.query).toHaveBeenCalledTimes(1)
            expect(events.record).not.toHaveBeenCalled()
            expect(tx.rollbacks).toBe(1)
        })

        it("refuses a lead the workspace does not have", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_RESPONSIBILITY, []] }))
            const { responsibilities, events } = await build(tx.em)

            await expect(responsibilities.addResponsibility(addOf())).rejects.toMatchObject({
                code: ResponsibilitiesErrorCode.LeadNotFound,
                params: { id: "lead-1" },
            })

            expect(events.record).not.toHaveBeenCalled()
            expect(tx.rollbacks).toBe(1)
        })
    })

    describe("assignResponsibility", () => {
        it("changes the step to the signed-in person and logs who owns it", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [UPDATE_RESPONSIBILITY, [{ ...STEP, next_action: "Call back", due_at: null }]],
                }),
            )
            const { responsibilities, events } = await build(tx.em)

            await expect(responsibilities.assignResponsibility(assignOf())).resolves.toMatchObject({
                id: "step-1",
                nextAction: "Call back",
                dueAt: null,
            })

            expect(tx.em.query).toHaveBeenCalledWith(UPDATE_RESPONSIBILITY, [
                "ws-1",
                "step-1",
                "human",
                null,
                "Linh",
                "Call back",
                null,
                null,
            ])
            expect(events.record).toHaveBeenCalledWith(
                expect.objectContaining({
                    leadId: "lead-1",
                    summary: 'responsibilities.owner-next:{"owner":"Linh","next":"Call back"}',
                }),
                expect.anything(),
            )
            expect(isTransactionManager(events.record.mock.calls[0]?.[1])).toBe(true)
        })

        it("changes the step to an agent and renames it when a title is given", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [FIND_AGENT, [{ id: "agent-1", name: "Sales AI" }]],
                        [UPDATE_RESPONSIBILITY, [{ ...STEP, owner_kind: "agent", owner_agent_id: "agent-1" }]],
                    ],
                }),
            )
            const { responsibilities } = await build(tx.em)

            await responsibilities.assignResponsibility(assignOf({ owner: "agent-1", title: "Renewal" }))

            expect(tx.em.query).toHaveBeenNthCalledWith(2, UPDATE_RESPONSIBILITY, [
                "ws-1",
                "step-1",
                "agent",
                "agent-1",
                "Sales AI",
                "Call back",
                null,
                "Renewal",
            ])
        })

        it("refuses a step the workspace does not have", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [UPDATE_RESPONSIBILITY, []] }))
            const { responsibilities, events } = await build(tx.em)

            await expect(responsibilities.assignResponsibility(assignOf())).rejects.toMatchObject({
                code: ResponsibilitiesErrorCode.NotFound,
                params: { id: "step-1" },
            })

            expect(events.record).not.toHaveBeenCalled()
        })

        it("refuses an owner that is not an agent of the workspace before changing the step", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [FIND_AGENT, []] }))
            const { responsibilities } = await build(tx.em)

            await expect(responsibilities.assignResponsibility(assignOf({ owner: "agent-9" }))).rejects.toMatchObject({
                code: ResponsibilitiesErrorCode.AgentNotFound,
            })

            expect(tx.em.query).toHaveBeenCalledTimes(1)
        })
    })

    describe("handToAccounting", () => {
        const handOf = (manager: MockEntityManager) => ({
            workspaceId: "ws-1",
            leadId: "lead-1",
            contactName: "Anh Minh",
            locale: "en" as const,
            manager,
        })

        it("hands the deal to the active Accounting agent as a step due the next day and logs it", async () => {
            const manager = mockEntityManager({
                query: [
                    [FIND_ACCOUNTING_AGENT, [{ id: "agent-9", name: "Accounting AI" }]],
                    [INSERT_RESPONSIBILITY, []],
                ],
            })
            const { responsibilities, events } = await build(manager)

            await expect(responsibilities.handToAccounting(handOf(manager))).resolves.toBe(true)

            expect(manager.query).toHaveBeenNthCalledWith(1, FIND_ACCOUNTING_AGENT, ["ws-1"])
            expect(manager.query).toHaveBeenNthCalledWith(2, INSERT_RESPONSIBILITY, [
                "ws-1",
                "lead-1",
                'responsibilities.invoice-title:{"name":"Anh Minh"}',
                "agent",
                "agent-9",
                "Accounting AI",
                "responsibilities.invoice-next:{}",
                "2026-10-13T03:00:00.000Z",
            ])
            expect(events.record).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    leadId: "lead-1",
                    kind: "responsibility.assigned",
                    actor: "Sales Agent",
                    summary: 'responsibilities.handed-event:{"agent":"Accounting AI"}',
                },
                manager,
            )
        })

        it("writes nothing when the workspace has no active Accounting agent", async () => {
            const manager = mockEntityManager({ query: [FIND_ACCOUNTING_AGENT, []] })
            const { responsibilities, events } = await build(manager)

            await expect(responsibilities.handToAccounting(handOf(manager))).resolves.toBe(false)

            expect(manager.query).toHaveBeenCalledTimes(1)
            expect(events.record).not.toHaveBeenCalled()
        })
    })
})
