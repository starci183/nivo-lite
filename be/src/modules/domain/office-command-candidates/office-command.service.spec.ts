import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { CommandBusService, ModuleCatalogService } from "@modules/domain/decisions"
import { OfficeLinesService } from "@modules/domain/messages"
import type { AcceptedCommand, CommandResult, ModuleEntry, WorkItem } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import type { ProposedCommand } from "@modules/integrations/deepseek"
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
import type { MessageTextRow } from "./persistence/office-command.rows"
import {
    ATTACH_WORK_ITEM,
    CANCEL_CANDIDATE,
    CLAIM_CANDIDATE,
    FIND_CANDIDATE,
    FIND_CANDIDATE_BY_MESSAGE,
    FIND_MESSAGE,
    INSERT_CANDIDATE,
    LIST_AGENTS_BY_HANDLE,
    LIST_CANDIDATES,
    LIST_LEAD_REFS,
    LIST_ORDER_REFS,
    RELEASE_CANDIDATE,
} from "./persistence/office-command.sql"

type Query = readonly [sql: string, rows: unknown]

const manager: WorkspaceMember = {
    userId: "u-1",
    workspaceId: "ws-1",
    role: "manager",
    staffId: null,
    displayName: "An",
    status: "active",
}
const receipt: AcceptedCommand = {
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
const humanMessage: MessageTextRow = { id: "m-1", author_kind: "human", body: "@ke-toan phieu thu cho don #DH-1" }
const agentRow = { id: "a-1", handle: "ke-toan", module: "accounting", name: "Mai" }
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

/** The queries of a propose up to the model call: message, no candidate yet, the agent, then the two reference pools. */
const reaching = (message: MessageTextRow = humanMessage): ReadonlyArray<Query> => [
    [FIND_MESSAGE, [message]],
    [FIND_CANDIDATE_BY_MESSAGE, []],
    [LIST_AGENTS_BY_HANDLE, [agentRow]],
    [LIST_LEAD_REFS, [{ id: "l-1", contact_name: "Lan", company: null }]],
    [LIST_ORDER_REFS, [{ id: "o-1", order_no: "DH-1", lead_id: "l-1" }]],
]

const build = async (queries: ReadonlyArray<Query>, entry: ModuleEntry | null = accounting) => {
    const entityManager = mockEntityManager({ query: queries })
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
        ],
    }).compile()
    const service = moduleRef.get(OfficeCommandService)
    return { service, entityManager, members, lines, bus, reader, events, catalog, logger }
}

const request = { messageId: "m-1", locale: "en" } as const
const confirmRequest = { candidateId: "c-1", locale: "vi" } as const
const reply = (key: string) => ({ kind: "reply", body: `[${key}]` })

describe("OfficeCommandService", () => {
    describe("propose", () => {
        it("turns a message into a confirm card and records the evidence", async () => {
            const created = candidateOf()
            const { service, entityManager, members, reader, events } = await build([
                ...reaching(),
                [INSERT_CANDIDATE, [created]],
            ])

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
            expect(entityManager.query).toHaveBeenCalledWith(LIST_AGENTS_BY_HANDLE, ["ws-1", ["ke-toan"]])
            expect(entityManager.query).toHaveBeenCalledWith(INSERT_CANDIDATE, [
                "ws-1",
                "m-1",
                "accounting",
                "issue_receipt",
                '{"subject_type":"order","subject_id":"o-1","lead_id":"l-1"}',
                "[office.cmdFor]",
                '[{"key":"customer","label":"[office.cmdFieldCustomer]","value":"Lan"},{"key":"order","label":"[office.cmdFieldOrder]","value":"#DH-1"}]',
                "An",
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
            const { service, entityManager, reader, catalog } = await build(
                [...reaching(), [INSERT_CANDIDATE, [candidateOf()]]],
                stock,
            )
            reader.proposeCommands.mockResolvedValue(choiceOf({ subject_id: null, fields: { note: "x" } }))

            await service.propose("u-1", "ws-1", request)

            expect(entityManager.query).toHaveBeenCalledWith(INSERT_CANDIDATE, [
                "ws-1",
                "m-1",
                "accounting",
                "issue_receipt",
                '{"subject_type":"stock","note":"x"}',
                "issue a receipt",
                '[{"key":"note","label":"note","value":"x"}]',
                "An",
            ])
            expect(catalog.get.mock.calls.map(([key]) => key)).not.toContain("office.cmdFor")
        })

        it("answers the existing card of a message without a second model call", async () => {
            const existing = candidateOf()
            const { service, reader } = await build([
                [FIND_MESSAGE, [humanMessage]],
                [FIND_CANDIDATE_BY_MESSAGE, [existing]],
            ])

            await expect(service.propose("u-1", "ws-1", request)).resolves.toEqual({
                kind: "card",
                candidate: existing,
            })
            expect(reader.proposeCommands).not.toHaveBeenCalled()
        })

        it("rejects a message that is missing or not a person's", async () => {
            const missing = await build([[FIND_MESSAGE, []]])
            await expect(missing.service.propose("u-1", "ws-1", request)).rejects.toMatchObject({
                code: OfficeCommandCandidatesErrorCode.MessageNotFound,
            })
            const system = await build([[FIND_MESSAGE, [{ ...humanMessage, author_kind: "system" }]]])
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
            const queries: ReadonlyArray<Query> = [
                [FIND_MESSAGE, [message]],
                [FIND_CANDIDATE_BY_MESSAGE, []],
                [LIST_AGENTS_BY_HANDLE, agents],
            ]
            const { service } = await build(queries, entry)

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
            const queries: ReadonlyArray<Query> = [
                ...reaching({ ...humanMessage, body: "@ke-toan phieu thu" }).slice(0, 3),
                [LIST_LEAD_REFS, []],
                [LIST_ORDER_REFS, []],
            ]
            const { service, reader, catalog } = await build(queries, needy)
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
            const { service, events, logger } = await build([...reaching(), [INSERT_CANDIDATE, [candidateOf()]]])
            const cause = new TypeError("down")
            events.record.mockRejectedValue(cause)

            await expect(service.propose("u-1", "ws-1", request)).resolves.toMatchObject({ kind: "card" })
            expect(logger.error).toHaveBeenCalledWith(OfficeCommandCandidatesLogEvent.EvidenceFailed, cause, {
                workspaceId: "ws-1",
            })
        })

        it("fails loudly when the insert answers no row", async () => {
            const { service } = await build([...reaching(), [INSERT_CANDIDATE, []]])

            await expect(service.propose("u-1", "ws-1", request)).rejects.toMatchObject({
                code: OfficeCommandCandidatesErrorCode.CandidateNotFound,
            })
        })
    })

    describe("list", () => {
        it("lists the latest candidates for owners and managers", async () => {
            const rows = [candidateOf()]
            const { service, entityManager, members } = await build([[LIST_CANDIDATES, rows]])

            await expect(service.list("u-1", "ws-1")).resolves.toEqual(rows)
            expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
            expect(entityManager.query).toHaveBeenCalledWith(LIST_CANDIDATES, ["ws-1", 60])
        })

        it("shows staff none", async () => {
            const { service, members } = await build([])
            members.require.mockResolvedValue({ ...manager, role: "staff" })

            await expect(service.list("u-1", "ws-1")).resolves.toEqual([])
        })
    })

    describe("confirm", () => {
        it("claims the candidate, sends the command as the owner and links the work item", async () => {
            const claimed = candidateOf({ status: "sent" })
            const { service, entityManager, bus } = await build([
                [CLAIM_CANDIDATE, [claimed]],
                [ATTACH_WORK_ITEM, []],
            ])

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
            expect(entityManager.query).toHaveBeenCalledWith(ATTACH_WORK_ITEM, ["ws-1", "c-1", "w-1"])
        })

        it("reports an existing work item as not created", async () => {
            const { service, bus } = await build([
                [CLAIM_CANDIDATE, [candidateOf()]],
                [ATTACH_WORK_ITEM, []],
            ])
            bus.sendCommand.mockResolvedValue(sentOk(false))

            await expect(service.confirm("u-1", "ws-1", confirmRequest)).resolves.toMatchObject({ created: false })
        })

        it("answers where an already sent candidate went instead of sending twice", async () => {
            const { service, bus } = await build([
                [CLAIM_CANDIDATE, []],
                [FIND_CANDIDATE, [candidateOf({ status: "sent", work_item_id: "w-9" })]],
            ])

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
                [candidateOf({ status: "cancelled" })],
                OfficeCommandCandidatesErrorCode.CandidateCancelled,
            ],
            ["an unknown candidate", [], OfficeCommandCandidatesErrorCode.CandidateNotFound],
            [
                "a candidate still being sent",
                [candidateOf({ status: "sent" })],
                OfficeCommandCandidatesErrorCode.CandidateInProgress,
            ],
        ])("refuses %s", async (_name, found, code) => {
            const { service } = await build([
                [CLAIM_CANDIDATE, []],
                [FIND_CANDIDATE, found],
            ])

            await expect(service.confirm("u-1", "ws-1", confirmRequest)).rejects.toMatchObject({ code })
        })

        it("puts the card back when the receiving module is not in the registry", async () => {
            const { service, entityManager, bus } = await build(
                [
                    [CLAIM_CANDIDATE, [candidateOf()]],
                    [RELEASE_CANDIDATE, []],
                ],
                null,
            )

            await expect(service.confirm("u-1", "ws-1", confirmRequest)).rejects.toMatchObject({
                code: OfficeCommandCandidatesErrorCode.ModuleUnknown,
                params: { module: "accounting" },
            })
            expect(entityManager.query).toHaveBeenCalledWith(RELEASE_CANDIDATE, ["ws-1", "c-1", "no agent accounting"])
            expect(bus.sendCommand).not.toHaveBeenCalled()
        })

        it("puts the card back with the reason when the bus refuses", async () => {
            const { service, entityManager, bus } = await build([
                [CLAIM_CANDIDATE, [candidateOf()]],
                [RELEASE_CANDIDATE, []],
            ])
            bus.sendCommand.mockResolvedValue({ ok: false, refused: "missing_fields", detail: "needs amount" })

            await expect(service.confirm("u-1", "ws-1", confirmRequest)).rejects.toMatchObject({
                code: OfficeCommandCandidatesErrorCode.CommandRefused,
                params: { detail: "needs amount" },
            })
            expect(entityManager.query).toHaveBeenCalledWith(RELEASE_CANDIDATE, ["ws-1", "c-1", "needs amount"])
        })

        it("puts the card back and rethrows when the bus fails", async () => {
            const { service, entityManager, bus } = await build([
                [CLAIM_CANDIDATE, [candidateOf()]],
                [RELEASE_CANDIDATE, []],
            ])
            const cause = new TypeError("bus down")
            bus.sendCommand.mockRejectedValue(cause)

            await expect(service.confirm("u-1", "ws-1", confirmRequest)).rejects.toBe(cause)
            expect(entityManager.query).toHaveBeenCalledWith(RELEASE_CANDIDATE, ["ws-1", "c-1", "bus down"])
        })
    })

    describe("cancel", () => {
        it("cancels a pending candidate", async () => {
            const { service, entityManager, members } = await build([[CANCEL_CANDIDATE, [{ id: "c-1" }]]])

            await expect(service.cancel("u-1", "ws-1", "c-1")).resolves.toBeUndefined()
            expect(members.require).toHaveBeenCalledWith("u-1", "ws-1", ["owner", "manager"])
            expect(entityManager.query).toHaveBeenCalledWith(CANCEL_CANDIDATE, ["ws-1", "c-1"])
        })

        it("treats a second cancel as done", async () => {
            const { service } = await build([
                [CANCEL_CANDIDATE, []],
                [FIND_CANDIDATE, [candidateOf({ status: "cancelled" })]],
            ])

            await expect(service.cancel("u-1", "ws-1", "c-1")).resolves.toBeUndefined()
        })

        it.each([
            ["unknown", [], OfficeCommandCandidatesErrorCode.CandidateNotFound],
            ["already sent", [candidateOf({ status: "sent" })], OfficeCommandCandidatesErrorCode.CandidateSent],
        ])("refuses a candidate that is %s", async (_name, found, code) => {
            const { service } = await build([
                [CANCEL_CANDIDATE, []],
                [FIND_CANDIDATE, found],
            ])

            await expect(service.cancel("u-1", "ws-1", "c-1")).rejects.toMatchObject({ code })
        })
    })
})
