import { Test } from "@nestjs/testing"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { AgentHandleCard } from "@modules/domain/agents"
import { LeadReadService } from "@modules/domain/leads"
import type { LeadName } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import type { OrderRef } from "@modules/domain/orders"
import { CommandBusService, ModuleCatalogService } from "@modules/domain/decisions"
import { MessagesReadService, OfficeLinesService } from "@modules/domain/messages"
import type { LineText } from "@modules/domain/messages"
import type { ModuleCommand, CommandResult, ModuleEntry, WorkItem } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import type { ProposedCommand } from "@modules/domain/ai-tasks"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OfficeCommandCandidatesErrorCode } from "./errors/office-command-candidates.error"
import type { CandidateView } from "./office-command-candidates.contracts"
import { COMMAND_READER } from "./office-command-candidates.decorators"
import { OfficeCommandCandidatesLogEvent } from "./office-command-candidates.log-events"
import type { CommandReader } from "./office-command-candidates.port"
import { OfficeCommandService } from "./office-command.service"
import { OfficeCommandCandidateEntity } from "./persistence/entities"

/** What a spec's database holds, in the order the service reaches for it: the query builders it creates, then the finds. */
interface Plan {
    /** The answers of the query builders, in the order the service creates them. */
    readonly builders: ReadonlyArray<QueryBuilderAnswers>
    /** The message the messages owner finds; none when it has no such message. */
    readonly message?: LineText
    /** The active agents a handle lookup finds. */
    readonly agents?: ReadonlyArray<AgentHandleCard>
    /** The recent customers the reference pool reads. */
    readonly leads?: ReadonlyArray<LeadName>
    /** The recent orders the reference pool reads. */
    readonly orders?: ReadonlyArray<OrderRef>
}

const manager: WorkspaceMember = {
    userId: "u-1",
    workspaceId: "ws-1",
    role: "manager",
    staffId: null,
    displayName: "An",
    status: "active",
}
const receipt: ModuleCommand = {
    command: "issue_receipt",
    action: "issue_receipt",
    subjectType: "order",
    requiredFields: [],
    description: { vi: "xuat phieu thu", en: "issue a receipt" },
}
const accounting: ModuleEntry = {
    key: "accounting",
    audience: "internal",
    multiInstance: false,
    name: { vi: "Ke toan", en: "Accounting" },
    accepts: [receipt],
}
const humanMessage: LineText = { id: "m-1", author_kind: "human", body: "@ke-toan phieu thu cho don #DH-1" }
const agentRow: AgentHandleCard = { id: "a-1", handle: "ke-toan", module: "accounting", name: "Mai" }
const orderRow: OrderRef = { id: "o-1", orderNo: "DH-1", leadId: "l-1" }
const leadRow: LeadName = { id: "l-1", contactName: "Lan", company: "" }
const candidateOf = builder<CandidateView>({
    id: "c-1",
    message_id: "m-1",
    module: "accounting",
    command: "issue_receipt",
    payload: { subject_type: "order", subject_id: "o-1", lead_id: "l-1" },
    summary: "issue a receipt for #DH-1",
    shown: [],
    status: "pending",
    work_item_id: null,
    refusal_detail: null,
    created_at: "2026-10-12T10:00:00+00:00",
})
const choiceOf = builder<ProposedCommand>({
    intent: "command",
    command: "issue_receipt",
    subject_id: "o-1",
    lead_id: null,
    fields: {},
})
const sentOk = (created: boolean): CommandResult => ({
    ok: true,
    item: mock<WorkItem>({ id: "w-1" }),
    created,
    chainId: null,
    depth: 0,
})

/** The world before proposing: the message, no candidate yet, the agent, the two reference pools and the answer of the insert. */
const reaching = (message: LineText = humanMessage, insert: ReadonlyArray<CandidateView> = []): Plan => ({
    message,
    builders: [{ getRawOne: undefined }, { execute: { raw: insert } }],
    agents: [agentRow],
    leads: [leadRow],
    orders: [orderRow],
})

const build = async (plan: Plan, entry: ModuleEntry | null = accounting) => {
    const entityManager = mockEntityManager({ update: [OfficeCommandCandidateEntity, { affected: 1 }] })
    const messages = mock<MessagesReadService>({ textOf: jest.fn().mockResolvedValue(plan.message) })
    const agents = mock<AgentDirectoryService>({ activeByHandles: jest.fn().mockResolvedValue(plan.agents ?? []) })
    const leads = mock<LeadReadService>({ recentNames: jest.fn().mockResolvedValue(plan.leads ?? []) })
    const orders = mock<OrdersService>({ recentRefs: jest.fn().mockResolvedValue(plan.orders ?? []) })
    const fakes = queueQueryBuilders(entityManager, plan.builders)
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(manager) })
    const modules = mock<ModuleCatalogService>({
        acceptsOf: jest.fn().mockResolvedValue(entry?.accepts ?? []),
        nameOf: jest.fn().mockResolvedValue("Accounting"),
        entryOf: jest.fn().mockResolvedValue(entry),
    })
    const lines = mock<OfficeLinesService>({ post: jest.fn().mockResolvedValue(undefined) })
    const bus = mock<CommandBusService>({ sendCommand: jest.fn().mockResolvedValue(sentOk(true)) })
    const reader = mock<CommandReader>({ proposeCommands: jest.fn().mockResolvedValue(choiceOf()) })
    const events = mock<EventsService>({ record: jest.fn().mockResolvedValue(undefined) })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OfficeCommandService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ModuleCatalogService, useValue: modules },
            { provide: OfficeLinesService, useValue: lines },
            { provide: CommandBusService, useValue: bus },
            { provide: COMMAND_READER, useValue: reader },
            { provide: EventsService, useValue: events },
            { provide: MessagesReadService, useValue: messages },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: LeadReadService, useValue: leads },
            { provide: OrdersService, useValue: orders },
        ],
    }).compile()
    const service = moduleRef.get(OfficeCommandService)
    return {
        service,
        entityManager,
        members,
        lines,
        bus,
        reader,
        events,
        catalog,
        logger,
        fakes,
        messages,
        agents,
        leads,
        orders,
    }
}

const request = { messageId: "m-1", locale: "en" } as const
const confirmRequest = { candidateId: "c-1", locale: "vi" } as const
const reply = (key: string) => ({ kind: "reply", body: `[${key}]` })

describe("OfficeCommandService propose", () => {
    it("turns a message into a confirm card and records the evidence", async () => {
        const created = candidateOf()
        const { service, members, reader, events, fakes, messages, agents, leads, orders } = await build(
            reaching(humanMessage, [created]),
        )

        await expect(service.propose("u-1", "ws-1", request)).resolves.toEqual({ kind: "card", candidate: created })

        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1", ["owner", "manager"])
        expect(reader.proposeCommands).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "en" },
            {
                agentName: "Accounting",
                options: [receipt],
                customers: [],
                orders: [{ id: "o-1", order_no: "DH-1", lead_id: "l-1" }],
                text: humanMessage.body,
            },
        )
        expect(messages.textOf).toHaveBeenCalledWith("ws-1", "m-1")
        expect(agents.activeByHandles).toHaveBeenCalledWith("ws-1", ["ke-toan"], 10)
        expect(leads.recentNames).toHaveBeenCalledWith("ws-1", 300)
        expect(orders.recentRefs).toHaveBeenCalledWith("ws-1", 300)
        expect(fakes[1]?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    messageId: "m-1",
                    module: "accounting",
                    command: "issue_receipt",
                    payload: { subject_type: "order", subject_id: "o-1", lead_id: "l-1" },
                    summary: "[office.cmdFor]",
                    shown: [
                        { key: "customer", label: "[office.cmdFieldCustomer]", value: "Lan" },
                        { key: "order", label: "[office.cmdFieldOrder]", value: "#DH-1" },
                    ],
                    createdBy: "An",
                },
            ],
        ])
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "command.candidate",
            actor: "An",
            summary: "owner -> accounting.issue_receipt",
            evidence: "m-1",
        })
    })

    it("names the command alone when it has no subject row", async () => {
        const stock: ModuleEntry = {
            ...accounting,
            accepts: [{ ...receipt, subjectType: "stock", requiredFields: ["note"] }],
        }
        const { service, reader, catalog, fakes } = await build(reaching(humanMessage, [candidateOf()]), stock)
        reader.proposeCommands.mockResolvedValue(choiceOf({ subject_id: null, fields: { note: "x" } }))

        await service.propose("u-1", "ws-1", request)

        expect(fakes[1]?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    messageId: "m-1",
                    module: "accounting",
                    command: "issue_receipt",
                    payload: { subject_type: "stock", note: "x" },
                    summary: "issue a receipt",
                    shown: [{ key: "note", label: "note", value: "x" }],
                    createdBy: "An",
                },
            ],
        ])
        expect(catalog.get.mock.calls.map(([key]) => key)).not.toContain("office.cmdFor")
    })
})
describe("OfficeCommandService propose", () => {
    it("answers the existing card of a message without a second model call", async () => {
        const existing = candidateOf()
        const { service, reader } = await build({ message: humanMessage, builders: [{ getRawOne: existing }] })

        await expect(service.propose("u-1", "ws-1", request)).resolves.toEqual({
            kind: "card",
            candidate: existing,
        })
        expect(reader.proposeCommands).not.toHaveBeenCalled()
    })

    it("rejects a message that is missing or not a person's", async () => {
        const missing = await build({ builders: [] })
        await expect(missing.service.propose("u-1", "ws-1", request)).rejects.toMatchObject({
            code: OfficeCommandCandidatesErrorCode.MessageNotFound,
        })
        const system = await build({ message: { ...humanMessage, author_kind: "system" }, builders: [] })
        await expect(system.service.propose("u-1", "ws-1", request)).rejects.toMatchObject({
            code: OfficeCommandCandidatesErrorCode.MessageNotHuman,
        })
    })

    it.each([
        ["no mention", { ...humanMessage, body: "hello" }, [], accounting],
        ["two mentions", { ...humanMessage, body: "@a @b hi" }, [], accounting],
        ["an unknown handle", humanMessage, [], accounting],
        ["an agent that accepts nothing", humanMessage, [agentRow], null],
    ])("leaves the message to the chat for %s", async (_name, message, agents, entry) => {
        const { service } = await build({ message, builders: [{ getRawOne: undefined }], agents }, entry)

        await expect(service.propose("u-1", "ws-1", request)).resolves.toEqual({ kind: "chat" })
    })

    it("leaves a question to the chat", async () => {
        const { service, reader, lines } = await build(reaching())
        reader.proposeCommands.mockResolvedValue(choiceOf({ intent: "question", command: null }))

        await expect(service.propose("u-1", "ws-1", request)).resolves.toEqual({ kind: "chat" })
        expect(lines.post).not.toHaveBeenCalled()
    })

    it("replies with what the agent accepts when the model call fails", async () => {
        const { service, reader, lines, logger, catalog } = await build(reaching())
        const cause = new TypeError("offline")
        reader.proposeCommands.mockRejectedValue(cause)

        await expect(service.propose("u-1", "ws-1", request)).resolves.toEqual(reply("office.cmdReadFailed"))
        expect(catalog.get).toHaveBeenCalledWith(
            "office.cmdReadFailed",
            { handle: "ke-toan", agent: "Accounting", list: "issue a receipt", error: "offline" },
            "en",
        )
        expect(logger.error).toHaveBeenCalledWith(OfficeCommandCandidatesLogEvent.CommandReadFailed, cause, {
            workspaceId: "ws-1",
        })
        expect(lines.post).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "An", locale: "en" },
            { body: "[office.cmdReadFailed]", lead_id: null, work_item_id: null },
        )
    })
})
describe("OfficeCommandService propose", () => {
    it("replies with the accepted commands when nothing maps", async () => {
        const { service, reader, catalog } = await build(reaching())
        reader.proposeCommands.mockResolvedValue(choiceOf({ command: "dance" }))

        await expect(service.propose("u-1", "ws-1", request)).resolves.toEqual(reply("office.cmdUnmapped"))
        expect(catalog.get).toHaveBeenCalledWith(
            "office.cmdUnmapped",
            { handle: "ke-toan", agent: "Accounting", list: "issue a receipt" },
            "en",
        )
    })

    it("asks for what the message lacks", async () => {
        const needy: ModuleEntry = {
            ...accounting,
            accepts: [{ ...receipt, requiredFields: ["subject_id", "amount"] }],
        }
        const plan: Plan = {
            message: { ...humanMessage, body: "@ke-toan phieu thu" },
            builders: [{ getRawOne: undefined }],
            agents: [agentRow],
            orders: [],
        }
        const { service, reader, catalog } = await build(plan, needy)
        reader.proposeCommands.mockResolvedValue(choiceOf({ subject_id: null }))

        await expect(service.propose("u-1", "ws-1", request)).resolves.toEqual(reply("office.cmdMissing"))
        expect(catalog.get).toHaveBeenCalledWith("office.cmdNeedOrder", { field: "order" }, "en")
        expect(catalog.get).toHaveBeenCalledWith("office.cmdNeedOther", { field: "amount" }, "en")
        expect(catalog.get).toHaveBeenCalledWith(
            "office.cmdMissing",
            { handle: "ke-toan", what: "issue a receipt", missing: "[office.cmdNeedOrder], [office.cmdNeedOther]" },
            "en",
        )
    })

    it("keeps the card when the evidence line cannot be written", async () => {
        const { service, events, logger } = await build(reaching(humanMessage, [candidateOf()]))
        const cause = new TypeError("down")
        events.record.mockRejectedValue(cause)

        await expect(service.propose("u-1", "ws-1", request)).resolves.toMatchObject({ kind: "card" })
        expect(logger.error).toHaveBeenCalledWith(OfficeCommandCandidatesLogEvent.EvidenceFailed, cause, {
            workspaceId: "ws-1",
        })
    })

    it("fails loudly when the insert answers no row", async () => {
        const { service } = await build(reaching(humanMessage, []))

        await expect(service.propose("u-1", "ws-1", request)).rejects.toMatchObject({
            code: OfficeCommandCandidatesErrorCode.CandidateNotFound,
        })
    })
})
describe("OfficeCommandService list", () => {
    it("lists the latest candidates for owners and managers", async () => {
        const rows = [candidateOf()]
        const { service, members, fakes } = await build({ builders: [{ getRawMany: rows }] })

        await expect(service.list("u-1", "ws-1")).resolves.toEqual(rows)
        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
        expect(fakes[0]?.callsOf("where")).toEqual([["c.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
        expect(fakes[0]?.callsOf("limit")).toEqual([[60]])
    })

    it("shows staff none", async () => {
        const { service, members } = await build({ builders: [] })
        members.require.mockResolvedValue({ ...manager, role: "staff" })

        await expect(service.list("u-1", "ws-1")).resolves.toEqual([])
    })
})
describe("OfficeCommandService confirm", () => {
    it("claims the candidate, sends the command as the owner and links the work item", async () => {
        const claimed = candidateOf({ status: "sent" })
        const { service, entityManager, bus, fakes } = await build({ builders: [{ execute: { raw: [claimed] } }] })

        await expect(service.confirm("u-1", "ws-1", confirmRequest)).resolves.toEqual({
            workItemId: "w-1",
            module: "accounting",
            created: true,
        })
        expect(bus.sendCommand).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "An", locale: "vi" },
            {
                from: "owner",
                to: "accounting",
                command: "issue_receipt",
                payload: claimed.payload,
                reason: "office:m-1",
            },
        )
        expect(fakes[0]?.callsOf("set")).toEqual([
            [{ status: "sent", decidedAt: expect.any(Function), refusalDetail: null }],
        ])
        expect(entityManager.update).toHaveBeenCalledWith(
            OfficeCommandCandidateEntity,
            { workspaceId: "ws-1", id: "c-1" },
            { workItemId: "w-1" },
        )
    })

    it("reports an existing work item as not created", async () => {
        const { service, bus } = await build({ builders: [{ execute: { raw: [candidateOf()] } }] })
        bus.sendCommand.mockResolvedValue(sentOk(false))

        await expect(service.confirm("u-1", "ws-1", confirmRequest)).resolves.toMatchObject({ created: false })
    })

    it("answers where an already sent candidate went instead of sending twice", async () => {
        const { service, bus } = await build({
            builders: [{ execute: { raw: [] } }, { getRawOne: candidateOf({ status: "sent", work_item_id: "w-9" }) }],
        })

        await expect(service.confirm("u-1", "ws-1", confirmRequest)).resolves.toEqual({
            workItemId: "w-9",
            module: "accounting",
            created: false,
        })
        expect(bus.sendCommand).not.toHaveBeenCalled()
    })

    it.each([
        [
            "a cancelled candidate",
            candidateOf({ status: "cancelled" }),
            OfficeCommandCandidatesErrorCode.CandidateCancelled,
        ],
        ["an unknown candidate", undefined, OfficeCommandCandidatesErrorCode.CandidateNotFound],
        [
            "a candidate still being sent",
            candidateOf({ status: "sent" }),
            OfficeCommandCandidatesErrorCode.CandidateInProgress,
        ],
    ])("refuses %s", async (_name, found, code) => {
        const { service } = await build({ builders: [{ execute: { raw: [] } }, { getRawOne: found }] })

        await expect(service.confirm("u-1", "ws-1", confirmRequest)).rejects.toMatchObject({ code })
    })
})
describe("OfficeCommandService confirm", () => {
    it("puts the card back when the receiving module is not in the registry", async () => {
        const { service, entityManager, bus } = await build({ builders: [{ execute: { raw: [candidateOf()] } }] }, null)

        await expect(service.confirm("u-1", "ws-1", confirmRequest)).rejects.toMatchObject({
            code: OfficeCommandCandidatesErrorCode.ModuleUnknown,
            params: { module: "accounting" },
        })
        expect(entityManager.update).toHaveBeenCalledWith(
            OfficeCommandCandidateEntity,
            { workspaceId: "ws-1", id: "c-1" },
            { status: "pending", decidedAt: null, refusalDetail: "no agent accounting" },
        )
        expect(bus.sendCommand).not.toHaveBeenCalled()
    })

    it("puts the card back with the reason when the bus refuses", async () => {
        const { service, entityManager, bus } = await build({ builders: [{ execute: { raw: [candidateOf()] } }] })
        bus.sendCommand.mockResolvedValue({ ok: false, refused: "missing_fields", detail: "needs amount" })

        await expect(service.confirm("u-1", "ws-1", confirmRequest)).rejects.toMatchObject({
            code: OfficeCommandCandidatesErrorCode.CommandRefused,
            params: { detail: "needs amount" },
        })
        expect(entityManager.update).toHaveBeenCalledWith(
            OfficeCommandCandidateEntity,
            { workspaceId: "ws-1", id: "c-1" },
            { status: "pending", decidedAt: null, refusalDetail: "needs amount" },
        )
    })

    it("puts the card back and rethrows when the bus fails", async () => {
        const { service, entityManager, bus } = await build({ builders: [{ execute: { raw: [candidateOf()] } }] })
        const cause = new TypeError("bus down")
        bus.sendCommand.mockRejectedValue(cause)

        await expect(service.confirm("u-1", "ws-1", confirmRequest)).rejects.toBe(cause)
        expect(entityManager.update).toHaveBeenCalledWith(
            OfficeCommandCandidateEntity,
            { workspaceId: "ws-1", id: "c-1" },
            { status: "pending", decidedAt: null, refusalDetail: "bus down" },
        )
    })
})
describe("OfficeCommandService cancel", () => {
    it("cancels a pending candidate", async () => {
        const { service, members, fakes } = await build({ builders: [{ execute: { raw: [{ id: "c-1" }] } }] })

        await expect(service.cancel("u-1", "ws-1", "c-1")).resolves.toBeUndefined()
        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1", ["owner", "manager"])
        expect(fakes[0]?.callsOf("where")).toEqual([
            [
                "workspace_id = :workspaceId AND id = :candidateId AND status = 'pending'",
                { workspaceId: "ws-1", candidateId: "c-1" },
            ],
        ])
    })

    it("treats a second cancel as done", async () => {
        const { service } = await build({
            builders: [{ execute: { raw: [] } }, { getRawOne: candidateOf({ status: "cancelled" }) }],
        })

        await expect(service.cancel("u-1", "ws-1", "c-1")).resolves.toBeUndefined()
    })

    it.each([
        ["unknown", undefined, OfficeCommandCandidatesErrorCode.CandidateNotFound],
        ["already sent", candidateOf({ status: "sent" }), OfficeCommandCandidatesErrorCode.CandidateSent],
    ])("refuses a candidate that is %s", async (_name, found, code) => {
        const { service } = await build({ builders: [{ execute: { raw: [] } }, { getRawOne: found }] })

        await expect(service.cancel("u-1", "ws-1", "c-1")).rejects.toMatchObject({ code })
    })
})
