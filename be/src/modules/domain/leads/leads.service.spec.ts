import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import type { MockEntityManager } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { MessagesService } from "@modules/domain/messages"
import { ResponsibilitiesService } from "@modules/domain/responsibilities"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG, REQUEST_LOCALE } from "@modules/platform/i18n"
import type { MessageCatalog, RequestLocale } from "@modules/platform/i18n"
import { LeadsErrorCode } from "./errors/leads.error"
import type { RecordOutcomeParams } from "./leads.contracts"
import { LeadsService } from "./leads.service"
import { UPDATE_LEAD_STAGE } from "./persistence/leads.sql"

const anything = (): unknown => expect.anything()

const paramsOf = builder<RecordOutcomeParams>({
    workspaceId: "ws-1",
    leadId: "lead-1",
    stage: "proposal",
    evidence: "Sent the quote",
    userId: "user-1",
    acceptLanguage: "en",
})

const LEAD = {
    id: "lead-1",
    contact_name: "Anh Minh",
    company: "Minh Co",
    channel: "website",
    need: "Website redesign",
    stage: "proposal",
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
    const teamChat = mock<MessagesService>()
    teamChat.postSystem.mockResolvedValue(undefined)
    const responsibilities = mock<ResponsibilitiesService>()
    responsibilities.handToAccounting.mockResolvedValue(true)
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: messages },
            { provide: REQUEST_LOCALE, useValue: requestLocale },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EventsService, useValue: events },
            { provide: MessagesService, useValue: teamChat },
            { provide: ResponsibilitiesService, useValue: responsibilities },
        ],
    }).compile()
    return { members, leads: moduleRef.get(LeadsService), events, teamChat, responsibilities, requestLocale }
}

describe("LeadsService", () => {
    describe("recordOutcome", () => {
        it("moves the stage and writes the evidence line and the team-chat line in one transaction", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [UPDATE_LEAD_STAGE, [LEAD]] }))
            const { leads, events, teamChat, requestLocale } = await build(tx.em)

            await expect(leads.recordOutcome(paramsOf())).resolves.toEqual({
                leadId: "lead-1",
                stage: "proposal",
                contactName: "Anh Minh",
                company: "Minh Co",
                channel: "website",
                need: "Website redesign",
                handedToAccounting: false,
            })

            expect(tx.em.query).toHaveBeenCalledWith(UPDATE_LEAD_STAGE, ["ws-1", "lead-1", "proposal"])
            expect(requestLocale.of).toHaveBeenCalledWith("en")
            expect(events.record).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    leadId: "lead-1",
                    kind: "outcome.recorded",
                    actor: "Linh",
                    summary: 'leads.stage-event:{"stage":"leads.stage.proposal:{}"}',
                    evidence: "Sent the quote",
                },
                anything(),
            )
            expect(isTransactionManager(events.record.mock.calls[0]?.[1])).toBe(true)
            expect(teamChat.postSystem).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                leadId: "lead-1",
                body: 'leads.stage-message:{"name":"Anh Minh","stage":"leads.stage.proposal:{}"}',
                manager: anything(),
            })
            expect(isTransactionManager(teamChat.postSystem.mock.calls[0]?.[0].manager)).toBe(true)
            expect(tx.commits).toBe(1)
        })

        it("records no evidence text as null", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [UPDATE_LEAD_STAGE, [LEAD]] }))
            const { leads, events } = await build(tx.em)

            await leads.recordOutcome(paramsOf({ evidence: "" }))

            expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ evidence: null }), anything())
        })

        it("refuses a lead the workspace does not have and writes nothing else", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [UPDATE_LEAD_STAGE, []] }))
            const { leads, events, teamChat } = await build(tx.em)

            await expect(leads.recordOutcome(paramsOf())).rejects.toMatchObject({
                code: LeadsErrorCode.NotFound,
                params: { id: "lead-1" },
            })

            expect(events.record).not.toHaveBeenCalled()
            expect(teamChat.postSystem).not.toHaveBeenCalled()
            expect(tx.rollbacks).toBe(1)
        })
    })
})

describe("LeadsService", () => {
    describe("recordOutcome", () => {
        it("hands a won deal to Accounting inside the same transaction", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [UPDATE_LEAD_STAGE, [{ ...LEAD, stage: "won" }]] }))
            const { leads, responsibilities } = await build(tx.em)

            await expect(leads.recordOutcome(paramsOf({ stage: "won" }))).resolves.toMatchObject({
                stage: "won",
                handedToAccounting: true,
            })

            expect(responsibilities.handToAccounting).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                leadId: "lead-1",
                contactName: "Anh Minh",
                locale: "en",
                manager: anything(),
            })
            expect(isTransactionManager(responsibilities.handToAccounting.mock.calls[0]?.[0].manager)).toBe(true)
        })

        it("reports no hand-over when the workspace has no Accounting agent", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [UPDATE_LEAD_STAGE, [{ ...LEAD, stage: "won" }]] }))
            const { leads, responsibilities } = await build(tx.em)
            responsibilities.handToAccounting.mockResolvedValue(false)

            await expect(leads.recordOutcome(paramsOf({ stage: "won" }))).resolves.toMatchObject({
                handedToAccounting: false,
            })
        })

        it("does not hand a lost deal to Accounting", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [UPDATE_LEAD_STAGE, [{ ...LEAD, stage: "lost" }]] }))
            const { leads, responsibilities } = await build(tx.em)

            await leads.recordOutcome(paramsOf({ stage: "lost" }))

            expect(responsibilities.handToAccounting).not.toHaveBeenCalled()
        })
    })
})
