import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { Not } from "typeorm"
import {
    LEAD,
    agentOwner,
    answerInsert,
    assignedEvent,
    ctx,
    inputOf,
    leadGuard,
    memberOf,
    personOf,
    rowOf,
    stepOf,
    task,
} from "@tests/fixtures/builders/responsibilities.builder"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { EventsService } from "@modules/domain/events"
import { AGENT_DIRECTORY } from "@modules/domain/messages"
import type { AgentDirectory, OptionalAgentIdentity } from "@modules/domain/messages"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ResponsibilitiesError, ResponsibilitiesErrorCode } from "./errors/responsibilities.error"
import { RESPONSIBILITY_LEAD_DESK } from "./responsibilities.decorators"
import type { LeadDesk } from "./responsibilities.port"
import { ResponsibilityOwnersService } from "./responsibility-owners.service"
import type { ResponsibilityListing } from "./responsibility-journal.contracts"
import { ResponsibilityEntity } from "./persistence/entities"
import { ResponsibilityJournalService } from "./responsibility-journal.service"

/** The update of the step `resp-1` of the first workspace the manager received. */
const expectStepUpdated = (em: MockEntityManager, changes: Record<string, string>) =>
    expect(em.update).toHaveBeenCalledWith(ResponsibilityEntity, { workspaceId: "ws-1", id: "resp-1" }, changes)

const registerEnsureFor = () => {
    describe("ensureFor", () => {
        registerResponsibilityOwnership()
        registerMissingCustomer()
    })

    describe("list", () => {
        it("lists the workspace's responsibilities for a member", async () => {
            const listing: ResponsibilityListing = {
                ...rowOf(),
                contact_name: "Binh",
                company: "Binh Co",
                leadStage: "new",
            }
            const em = mockEntityManager()
            const read = fakeQueryBuilder({ getRawMany: [rowOf(), rowOf({ id: "resp-2", lead_id: "lead-gone" })] })
            answerQueryBuilders(em, read)
            const { service, members, leadDesk } = await build(em)
            leadDesk.cardsOf.mockResolvedValue([
                { id: "lead-1", contactName: "Binh", company: "Binh Co", stage: "new" },
            ])

            await expect(service.list("user-1", "ws-1")).resolves.toEqual([listing])
            expect(leadDesk.cardsOf).toHaveBeenCalledWith("ws-1", ["lead-1", "lead-gone"])
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(read.argsOf("where")).toEqual([["r.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
        })
    })
}

const registerCreate = () => {
    describe("create", () => {
        it("adds a responsibility owned by the member the caller names and logs it", async () => {
            const created = rowOf({ owner_kind: "human", owner_agent_id: null, owner_name: "An", next_action: "Call" })
            const em = mockEntityManager()
            const { write } = answerInsert(em, { id: "lead-1" }, [created])
            const tx = fakeTransaction(em)
            const { service, events, owners, leadDesk } = await build(tx.em)
            owners.resolve.mockResolvedValue(personOf())

            await expect(service.create("user-1", "ws-1", inputOf())).resolves.toEqual(created)

            expect(owners.resolve.mock.calls).toEqual([["ws-1", "member-1"]])
            expect(leadDesk.hold).toHaveBeenCalledWith("ws-1", "lead-1", expect.anything())
            expect(em.createQueryBuilder).toHaveBeenCalledWith(ResponsibilityEntity, "r")
            expect(write.callsOf("insert")).toEqual([[]])
            expect(write.argsOf("values")).toEqual([[stepOf()]])
            expect(write.argsOf("returning")).toEqual([[expect.stringContaining("to_json(due_at) #>> '{}' AS due_at")]])
            expect(tx.commits).toBe(1)
            expect(events.record).toHaveBeenCalledWith(assignedEvent("An: Call"), em)
        })

        it("adds a responsibility owned by one of the workspace's agents, with no member", async () => {
            const em = mockEntityManager()
            const { write } = answerInsert(em, { id: "lead-1" }, [rowOf()])
            const { service, owners } = await build(fakeTransaction(em).em)
            owners.resolve.mockResolvedValue(agentOwner())

            await service.create("user-1", "ws-1", inputOf({ owner: "agent-1" }))

            expect(write.argsOf("values")).toEqual([
                [
                    stepOf({
                        ownerKind: "agent",
                        ownerAgentId: "agent-1",
                        ownerMemberId: null,
                        ownerName: "Sales Agent",
                    }),
                ],
            ])
        })

        it("writes nothing when the owner is refused", async () => {
            const em = mockEntityManager()
            const { service, owners } = await build(em)
            const refusal = new ResponsibilitiesError({ code: ResponsibilitiesErrorCode.OwnerNotFound })
            owners.resolve.mockRejectedValue(refusal)

            await expect(service.create("user-1", "ws-1", inputOf({ owner: "agent-9" }))).rejects.toBe(refusal)

            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })
    })
}

const registerUpdateStatus = () => {
    describe("updateStatus", () => {
        it("moves the responsibility", async () => {
            const em = mockEntityManager()
            const write = fakeQueryBuilder({ execute: { raw: [rowOf({ status: "done" })] } })
            answerQueryBuilders(em, write)
            const { service, members } = await build(em)

            await expect(service.updateStatus("user-1", "ws-1", "resp-1", "done")).resolves.toEqual(
                rowOf({ status: "done" }),
            )
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(em.createQueryBuilder).toHaveBeenCalledWith(ResponsibilityEntity, "r")
            expect(write.callsOf("update")).toEqual([[]])
            expect(write.argsOf("set")).toEqual([[{ status: "done" }]])
            expect(write.argsOf("where")).toEqual([[{ workspaceId: "ws-1", id: "resp-1" }]])
        })

        it("refuses a responsibility that is not in the workspace", async () => {
            const em = mockEntityManager()
            answerQueryBuilders(em, fakeQueryBuilder({ execute: { raw: [] } }))
            const { service } = await build(em)

            await expect(service.updateStatus("user-1", "ws-1", "resp-9", "open")).rejects.toMatchObject({
                code: ResponsibilitiesErrorCode.NotFound,
            })
        })
    })

    describe("markWaitingApproval", () => {
        it("moves the responsibility to waiting for approval", async () => {
            const em = mockEntityManager({ update: [ResponsibilityEntity, { affected: 1 }] })
            const { service } = await build(em)

            await service.markWaitingApproval(ctx, "resp-1")

            expectStepUpdated(em, { status: "waiting_approval" })
        })
    })
}

const NURTURE = { title: "Nurture Binh", nextAction: "Call back", dueAt: new Date("2026-10-14T10:00:00.000Z") }

const registerOpenNamed = () => {
    describe("openNamed", () => {
        it("opens a follow-up owned by the active member with the named name", async () => {
            const em = mockEntityManager({ exists: [ResponsibilityEntity, false] })
            const { write } = answerInsert(em, { id: "lead-1" }, [
                rowOf({ owner_kind: "human", owner_agent_id: null, owner_name: "Linh" }),
            ])
            const { service, owners } = await build(fakeTransaction(em).em)
            owners.memberNamed.mockResolvedValue({ ...personOf(), memberId: "member-2", name: "Linh" })

            await expect(service.openNamed("ws-1", task)).resolves.toBe(true)
            expect(owners.memberNamed.mock.calls).toEqual([["ws-1", "Linh"]])
            expect(em.exists).toHaveBeenCalledWith(ResponsibilityEntity, {
                where: { workspaceId: "ws-1", leadId: "lead-1", title: "Nurture Binh", status: Not("done") },
            })
            expect(write.argsOf("values")).toEqual([
                [stepOf({ ...NURTURE, ownerMemberId: "member-2", ownerName: "Linh" })],
            ])
        })

        it("falls to the workspace owner when no active member carries the name", async () => {
            const em = mockEntityManager({ exists: [ResponsibilityEntity, false] })
            const { write } = answerInsert(em, { id: "lead-1" }, [rowOf()])
            const { service, owners } = await build(fakeTransaction(em).em)
            owners.memberNamed.mockResolvedValue(null)
            owners.workspaceOwner.mockResolvedValue({ ...personOf(), memberId: "member-9", name: "Chu Van" })

            await expect(service.openNamed("ws-1", task)).resolves.toBe(true)
            expect(write.argsOf("values")).toEqual([
                [stepOf({ ...NURTURE, ownerMemberId: "member-9", ownerName: "Chu Van" })],
            ])
        })

        it("opens nothing when the customer has an open one with the same title", async () => {
            const em = mockEntityManager({ exists: [ResponsibilityEntity, true] })
            const { service } = await build(em)

            await expect(service.openNamed("ws-1", task)).resolves.toBe(false)
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })
    })
}

const registerJourneyAndBoardReaders = () => {
    describe("journey and board readers", () => {
        it("returns the customer's journey in the query's order", async () => {
            const rows = [rowOf(), rowOf({ id: "resp-2", status: "done" })]
            const em = mockEntityManager()
            const read = fakeQueryBuilder({ getRawMany: rows })
            answerQueryBuilders(em, read)
            const { service } = await build(em)

            await expect(service.listForLead("ws-1", "lead-1")).resolves.toEqual(rows)
            expect(read.argsOf("where")).toEqual([
                ["r.workspaceId = :workspaceId AND r.leadId = :leadId", { workspaceId: "ws-1", leadId: "lead-1" }],
            ])
            expect(read.argsOf("limit")).toEqual([[200]])
        })

        it("returns the workspace's open follow-ups", async () => {
            const em = mockEntityManager()
            const read = fakeQueryBuilder({ getRawMany: [rowOf()] })
            answerQueryBuilders(em, read)
            const { service } = await build(em)

            await expect(service.listOpen("ws-1")).resolves.toEqual([rowOf()])
            expect(read.argsOf("where")).toEqual([
                ["r.workspaceId = :workspaceId AND r.status <> 'done'", { workspaceId: "ws-1" }],
            ])
            expect(read.argsOf("orderBy")).toEqual([["r.dueAt", "ASC", "NULLS LAST"]])
        })

        it("scopes the oldest open board steps to the workspace and current page's lead ids", async () => {
            const rows = [rowOf(), rowOf({ id: "older-step", lead_id: "older-lead" })]
            const em = mockEntityManager()
            const read = fakeQueryBuilder({ getRawMany: rows })
            answerQueryBuilders(em, read)
            const { service } = await build(em)
            const leadIds = ["lead-1", "older-lead"]

            await expect(service.listForBoard("ws-1", leadIds)).resolves.toEqual(rows)
            expect(read.argsOf("distinctOn")).toEqual([[["r.lead_id"]]])
            expect(read.argsOf("where")).toEqual([
                [
                    "r.workspaceId = :workspaceId AND r.leadId = ANY(:leadIds::uuid[]) AND r.status <> 'done'",
                    { workspaceId: "ws-1", leadIds },
                ],
            ])
        })

        it("answers no board steps without querying when the page has no leads", async () => {
            const em = mockEntityManager()
            const { service } = await build(em)

            await expect(service.listForBoard("ws-1", [])).resolves.toEqual([])

            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })
    })
}

const registerEngineUpdates = () => {
    describe("engine updates", () => {
        it("finds a responsibility with the primary manager", async () => {
            const em = mockEntityManager()
            const read = fakeQueryBuilder({ getRawOne: rowOf() })
            answerQueryBuilders(em, read)
            const { service } = await build(em)

            await expect(service.find("ws-1", "resp-1")).resolves.toEqual(rowOf())
            expect(read.argsOf("where")).toEqual([
                [
                    "r.workspaceId = :workspaceId AND r.id = :responsibilityId",
                    { workspaceId: "ws-1", responsibilityId: "resp-1" },
                ],
            ])
        })

        it("returns null for a missing responsibility using the caller's transaction", async () => {
            const em = mockEntityManager()
            const transaction = mockEntityManager()
            const read = fakeQueryBuilder({ getRawOne: undefined })
            answerQueryBuilders(transaction, read)
            const { service } = await build(em)

            await expect(service.find("ws-2", "missing", transaction)).resolves.toBeNull()
            expect(read.argsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-2", responsibilityId: "missing" })
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("sets a status through the primary manager", async () => {
            const em = mockEntityManager({ update: [ResponsibilityEntity, { affected: 1 }] })
            const { service } = await build(em)

            await expect(service.setStatus(ctx, "resp-1", "done")).resolves.toBeUndefined()
            expectStepUpdated(em, { status: "done" })
        })

        it("sets a status inside the supplied transaction", async () => {
            const em = mockEntityManager()
            const transaction = mockEntityManager({ update: [ResponsibilityEntity, { affected: 1 }] })
            const { service } = await build(em)

            await expect(service.setStatus(ctx, "resp-1", "waiting_approval", transaction)).resolves.toBeUndefined()
            expectStepUpdated(transaction, { status: "waiting_approval" })
            expect(em.update).not.toHaveBeenCalled()
        })

        it("sets the responsibility's next action", async () => {
            const em = mockEntityManager({ update: [ResponsibilityEntity, { affected: 1 }] })
            const { service } = await build(em)

            await expect(service.setNextAction(ctx, "resp-1", "Send quote")).resolves.toBeUndefined()
            expectStepUpdated(em, { nextAction: "Send quote" })
        })
    })
}

const registerAgentAssignment = () => {
    it("creates and records an agent assignment in the caller's transaction", async () => {
        const em = mockEntityManager()
        const transaction = fakeTransaction(mockEntityManager()).em
        const { write } = answerInsert(transaction, { id: "lead-1" }, [rowOf()])
        const { service, members, events, owners } = await build(em)
        owners.resolve.mockResolvedValue(agentOwner())

        await expect(service.create("user-1", "ws-1", inputOf({ owner: "agent-1" }), transaction)).resolves.toEqual(
            rowOf(),
        )
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(owners.resolve.mock.calls).toEqual([["ws-1", "agent-1"]])
        expect(events.record).toHaveBeenCalledWith(assignedEvent("Sales Agent: Classify"), transaction)
        expect(write.argsOf("values")).toHaveLength(1)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
}

const registerResponsibilityOwnership = () => {
    it("answers the open responsibility of the customer", async () => {
        const em = mockEntityManager()
        const open = fakeQueryBuilder({ getRawOne: rowOf() })
        answerQueryBuilders(em, open)
        const { service } = await build(em)

        await expect(service.ensureFor(ctx, "lead-1")).resolves.toEqual(rowOf())
        expect(open.argsOf("where")).toEqual([
            [
                "r.workspaceId = :workspaceId AND r.leadId = :leadId AND r.status <> 'done'",
                { workspaceId: "ws-1", leadId: "lead-1" },
            ],
        ])
        expect(em.transaction).not.toHaveBeenCalled()
    })

    it("creates one owned by the Sales agent, due in a day", async () => {
        const em = mockEntityManager()
        const { write } = answerCustomerLookups(em, LEAD, [rowOf()])
        const { service, directory } = await build(fakeTransaction(em).em, { id: "agent-1", name: "Sales Agent" })

        await expect(service.ensureFor(ctx, "lead-1")).resolves.toEqual(rowOf())

        expect(directory.agentOfDepartment).toHaveBeenCalledWith("ws-1", "sales", null)
        expect(write.argsOf("values")).toEqual([
            [
                stepOf({
                    title: "responsibility.title:Binh",
                    ownerKind: "agent",
                    ownerAgentId: "agent-1",
                    ownerMemberId: null,
                    ownerName: "Sales Agent",
                    nextAction: "responsibility.next:",
                    dueAt: new Date("2026-10-13T10:00:00.000Z"),
                }),
            ],
        ])
    })

    it("is owned by the workspace owner member when the workspace has no Sales agent", async () => {
        const em = mockEntityManager()
        const { write } = answerCustomerLookups(em, LEAD, [
            rowOf({ owner_kind: "human", owner_agent_id: null, owner_name: "Chu Van" }),
        ])
        const { service, owners } = await build(fakeTransaction(em).em)
        owners.workspaceOwner.mockResolvedValue({ ...personOf(), memberId: "member-9", name: "Chu Van" })

        await service.ensureFor(ctx, "lead-1")

        expect(write.argsOf("values")).toEqual([
            [
                stepOf({
                    title: "responsibility.title:Binh",
                    ownerMemberId: "member-9",
                    ownerName: "Chu Van",
                    nextAction: "responsibility.next:",
                    dueAt: new Date("2026-10-13T10:00:00.000Z"),
                }),
            ],
        ])
    })

    it("refuses a customer that is not in the workspace", async () => {
        const em = mockEntityManager()
        answerCustomerLookups(em, undefined)
        const { service } = await build(em)

        await expect(service.ensureFor(ctx, "lead-9")).rejects.toMatchObject({
            code: ResponsibilitiesErrorCode.NotFound,
        })
    })
}

const registerMissingCustomer = () => {
    it("refuses when the customer vanished before the insert", async () => {
        const em = mockEntityManager()
        const { write } = answerCustomerLookups(em, LEAD, [], null)
        const { service } = await build(fakeTransaction(em).em)

        await expect(service.ensureFor(ctx, "lead-1")).rejects.toMatchObject({
            code: ResponsibilitiesErrorCode.NotFound,
        })
        expect(write.argsOf("values")).toEqual([])
    })
}

/**
 * Answers the open-step lookup with nothing, the customer lookup with the given customer, then the guarding read of the insert
 * (`guard`, null meaning the customer vanished) and the insert with `inserted`.
 */
const answerCustomerLookups = (
    em: MockEntityManager,
    lead: typeof LEAD | undefined,
    inserted: ReadonlyArray<unknown> = [],
    guard: { readonly id: string } | null = { id: "lead-1" },
) => {
    leadGuard.name = lead
    return answerInsert(em, guard ?? undefined, inserted, fakeQueryBuilder({ getRawOne: undefined }))
}

const build = async (entityManager: MockEntityManager, sales: OptionalAgentIdentity = null) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(memberOf()) })
    const events = mock<EventsService>({ record: jest.fn().mockResolvedValue(undefined) })
    const directory = mock<AgentDirectory>({ agentOfDepartment: jest.fn().mockResolvedValue(sales) })
    const leadDesk = mock<LeadDesk>()
    leadDesk.hold.mockImplementation(() => Promise.resolve(leadGuard.held))
    leadDesk.cardsOf.mockImplementation(() =>
        Promise.resolve(
            leadGuard.name === undefined
                ? []
                : [{ id: "lead-1", contactName: leadGuard.name.contact_name, company: "", stage: "new" }],
        ),
    )
    const owners = mock<ResponsibilityOwnersService>()
    owners.workspaceOwner.mockResolvedValue(personOf())
    owners.memberNamed.mockResolvedValue(null)
    const catalog = mock<MessageCatalog>({
        get: jest.fn((key: string, params: Readonly<Record<string, string | number>>) => `${key}:${params.name ?? ""}`),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ResponsibilityJournalService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AGENT_DIRECTORY, useValue: directory },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EventsService, useValue: events },
            { provide: ResponsibilityOwnersService, useValue: owners },
            { provide: RESPONSIBILITY_LEAD_DESK, useValue: leadDesk },
        ],
    }).compile()
    return {
        service: moduleRef.get(ResponsibilityJournalService),
        members,
        events,
        directory,
        owners,
        leadDesk,
    }
}

describe("ResponsibilityJournalService", () => {
    registerEnsureFor()
    registerCreate()
    registerUpdateStatus()
    registerOpenNamed()
    registerJourneyAndBoardReaders()
    registerEngineUpdates()
    registerAgentAssignment()
})
