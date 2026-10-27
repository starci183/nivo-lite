import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { ActionEntry, Performed, Proposal, WorkContext, WorkItem } from "./decisions.contracts"
import { EvidenceService } from "./evidence.service"
import { ModuleCatalogService } from "./module-catalog.service"
import { OfficeLinesService } from "@modules/domain/messages"
import type { FinishPlan } from "./work-engine.contracts"
import { DECISION_EVENTS, INBOUND_EVENT_STATUS } from "./work-engine.decorators"
import { WorkEngineLogEvent } from "./work-engine.log-events"
import type { DecisionEvents, InboundEventStatus } from "./work-engine.port"
import { WorkRecorderService } from "./work-recorder.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_quote",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: "in-1",
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "done",
    decided_path: null,
    reason: "over_authority",
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Quote", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: "2026-10-12T10:00:00.000Z",
    completed_at: null,
    installation_id: "inst-1",
})

const proposal: Proposal = { summary: "Quote", fields: { items: "tea" } }
const performed: Performed = { summary: "Sent", evidence: "captured", detail: "msg-1" }
const action: ActionEntry = {
    action: "send_quote",
    moduleKey: "sales",
    maxMode: null,
    next: [],
    label: { vi: "Gui", en: "Send quote" },
}

interface Built {
    readonly service: WorkRecorderService
    readonly decide: jest.Mock
    readonly log: jest.Mock
    readonly post: jest.Mock
    readonly mark: jest.Mock
    readonly decisionMade: jest.Mock
    readonly error: jest.Mock<void, Parameters<Logger["error"]>>
}

const build = async (found: ActionEntry | null = action): Promise<Built> => {
    const decide = jest.fn().mockResolvedValue(undefined)
    const log = jest.fn().mockResolvedValue(undefined)
    const post = jest.fn().mockResolvedValue(undefined)
    const mark = jest.fn().mockResolvedValue(undefined)
    const decisionMade = jest.fn().mockResolvedValue(undefined)
    const error = jest.fn<void, Parameters<Logger["error"]>>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkRecorderService,
            { provide: LOGGER, useValue: mock<Logger>({ error }) },
            {
                provide: MESSAGE_CATALOG,
                useValue: mock<MessageCatalog>({
                    get: jest.fn(
                        (key: string, params: Readonly<Record<string, string | number>>) =>
                            `${key}(${Object.values(params).join(",")})`,
                    ),
                }),
            },
            { provide: INBOUND_EVENT_STATUS, useValue: mock<InboundEventStatus>({ mark }) },
            { provide: DECISION_EVENTS, useValue: mock<DecisionEvents>({ decisionMade }) },
            {
                provide: ModuleCatalogService,
                useValue: mock<ModuleCatalogService>({
                    nameOf: jest.fn().mockResolvedValue("Sales AI"),
                    actionOf: jest.fn().mockResolvedValue(found),
                }),
            },
            { provide: EvidenceService, useValue: mock<EvidenceService>({ decide, log }) },
            { provide: OfficeLinesService, useValue: mock<OfficeLinesService>({ post }) },
        ],
    }).compile()
    return { service: moduleRef.get(WorkRecorderService), decide, log, post, mark, decisionMade, error }
}

const auto: FinishPlan = { path: "auto", by: { name: "NIVO", kind: "policy" }, outcome: "auto_done" }
const human: FinishPlan = {
    path: "human",
    by: { name: "Lan", kind: "owner", memberId: "member-1" },
    outcome: "edited",
    note: "ok",
    before: { summary: "Before", fields: {} },
}

describe("WorkRecorderService", () => {
    describe("finished", () => {
        it("logs an automatic finish as a policy decision", async () => {
            const built = await build()

            await built.service.finished(ctx, itemOf(), itemOf(), proposal, auto, performed)

            expect(built.decide).toHaveBeenCalledWith(ctx, {
                work_item_id: "item-1",
                lead_id: "lead-1",
                department: "sales",
                action: "send_quote",
                decided_by: "NIVO",
                decider_kind: "policy",
                outcome: "auto_done",
                reason: "routine",
                note: "Sent",
            })
            expect(built.log).toHaveBeenCalledWith(ctx, {
                lead_id: "lead-1",
                work_item_id: "item-1",
                kind: "work.auto_done",
                actor: "Sales AI",
                summary: "Sent",
                evidence: "msg-1",
            })
            expect(built.post).toHaveBeenCalledWith(ctx, {
                dept: "sales",
                lead_id: "lead-1",
                work_item_id: "item-1",
                installation_id: "inst-1",
                body: "engine.auto(Sales AI,Sent)",
            })
            expect(built.decisionMade).not.toHaveBeenCalled()
            expect(built.mark).toHaveBeenCalledWith(ctx, "in-1", "processed", "lead-1")
        })
    })
})

describe("WorkRecorderService", () => {
    describe("finished", () => {
        it("logs a person's finish with their name, note and the proposal before and after", async () => {
            const built = await build()

            await built.service.finished(ctx, itemOf({ reason: "missing_data" }), itemOf(), proposal, human, {
                summary: "Sent",
                evidence: "captured",
            })

            expect(built.decide).toHaveBeenCalledWith(ctx, {
                work_item_id: "item-1",
                lead_id: "lead-1",
                department: "sales",
                action: "send_quote",
                decided_by: "Lan",
                decider_kind: "owner",
                decided_by_member_id: "member-1",
                outcome: "edited",
                reason: "missing_data",
                note: "ok",
                before: { summary: "Before", fields: {} },
                after: proposal,
            })
            expect(built.log).toHaveBeenCalledWith(ctx, {
                lead_id: "lead-1",
                work_item_id: "item-1",
                kind: "work.resumed",
                actor: "Lan",
                summary: "Sent",
                evidence: null,
            })
            expect(built.post).toHaveBeenCalledWith(ctx, expect.objectContaining({ body: "engine.resumed(Lan,Sent)" }))
            expect(built.decisionMade).toHaveBeenCalledWith(
                ctx,
                {
                    work_item_id: "item-1",
                    action: "send_quote",
                    department: "sales",
                    outcome: "edited",
                    decided_by: "Lan",
                    lead_id: "lead-1",
                    summary: "Sent",
                },
                "decision.made:item-1:edited",
            )
        })

        it("falls back to the summary as the note and to no proposal before", async () => {
            const built = await build()
            const plain: FinishPlan = { path: "human", by: { name: "Lan", kind: "staff" }, outcome: "approved" }

            await built.service.finished(ctx, itemOf(), itemOf(), proposal, plain, performed)

            expect(built.decide).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    note: "Sent",
                    before: null,
                    decider_kind: "staff",
                    decided_by_member_id: null,
                    outcome: "approved",
                }),
            )
        })

        it("leaves the inbound event alone when the item came from none, and survives a down event stream", async () => {
            const built = await build()
            built.decisionMade.mockRejectedValue(new RangeError("down"))

            await built.service.finished(ctx, itemOf(), itemOf({ inbound_event_id: null }), proposal, human, performed)

            expect(built.mark).not.toHaveBeenCalled()
            expect(built.error).toHaveBeenCalledWith(WorkEngineLogEvent.DecisionEventFailed, expect.any(RangeError))
        })
    })
})

describe("WorkRecorderService", () => {
    it("writes no evidence text for an automatic finish without detail", async () => {
        const built = await build()

        await built.service.finished(ctx, itemOf(), itemOf(), proposal, auto, { summary: "Sent", evidence: "captured" })

        expect(built.log).toHaveBeenCalledWith(ctx, expect.objectContaining({ kind: "work.auto_done", evidence: null }))
    })

    describe("rejected", () => {
        it("names no member when the person who rejected has no seat id", async () => {
            const built = await build()

            await built.service.rejected(
                ctx,
                itemOf(),
                { summary: "Merged", fields: {} },
                { name: "NIVO", kind: "owner" },
                null,
            )

            expect(built.decide).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({ decided_by: "NIVO", decided_by_member_id: null, outcome: "rejected" }),
            )
        })

        it("logs the rejection, tells the Office and publishes the decision", async () => {
            const built = await build()
            const by = { name: "Lan", kind: "owner", memberId: "member-1" } as const
            const merged: Proposal = { summary: "Merged", fields: {} }

            await built.service.rejected(ctx, itemOf(), merged, by, "too much")

            expect(built.decide).toHaveBeenCalledWith(ctx, {
                work_item_id: "item-1",
                lead_id: "lead-1",
                department: "sales",
                action: "send_quote",
                decided_by: "Lan",
                decider_kind: "owner",
                decided_by_member_id: "member-1",
                outcome: "rejected",
                reason: "over_authority",
                note: "too much",
                before: { summary: "Quote", fields: {} },
                after: merged,
            })
            expect(built.log).toHaveBeenCalledWith(ctx, {
                lead_id: "lead-1",
                work_item_id: "item-1",
                kind: "work.rejected",
                actor: "Lan",
                summary: "engine.rejected(Lan,Quote)",
                evidence: "too much",
            })
            expect(built.post).toHaveBeenCalledWith(ctx, {
                dept: "sales",
                body: "engine.rejected(Lan,Quote)",
                lead_id: "lead-1",
                work_item_id: "item-1",
                installation_id: "inst-1",
            })
            expect(built.mark).toHaveBeenCalledWith(ctx, "in-1", "processed", null)
            expect(built.decisionMade).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({ outcome: "rejected", summary: "Quote" }),
                "decision.made:item-1:rejected",
            )
        })
    })
})

describe("WorkRecorderService", () => {
    describe("failed", () => {
        it("tells the log, the Office and the inbound event", async () => {
            const built = await build()

            await built.service.failed(ctx, itemOf(), "boom")

            const body = "engine.failed(Sales AI,Send quote,boom)"
            expect(built.log).toHaveBeenCalledWith(ctx, {
                lead_id: "lead-1",
                work_item_id: "item-1",
                kind: "work.failed",
                actor: "NIVO",
                summary: body,
            })
            expect(built.post).toHaveBeenCalledWith(ctx, {
                dept: "sales",
                body,
                lead_id: "lead-1",
                work_item_id: "item-1",
                installation_id: "inst-1",
            })
            expect(built.mark).toHaveBeenCalledWith(ctx, "in-1", "failed", null)
        })

        it("names an unknown action by its key and has no inbound event to mark", async () => {
            const built = await build(null)

            await built.service.failed(ctx, itemOf({ inbound_event_id: null }), "boom")

            expect(built.log).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({ summary: "engine.failed(Sales AI,send_quote,boom)" }),
            )
            expect(built.mark).not.toHaveBeenCalled()
        })

        it("leaves the input alone when a later step of its chain fails", async () => {
            const built = await build()

            await built.service.failed(ctx, itemOf({ parent_id: "root-1", chain_id: "root-1", depth: 1 }), "boom")

            expect(built.log).toHaveBeenCalledWith(ctx, expect.objectContaining({ kind: "work.failed" }))
            expect(built.post).toHaveBeenCalledWith(ctx, expect.objectContaining({ work_item_id: "item-1" }))
            expect(built.mark).not.toHaveBeenCalled()
        })

        it("lets no line fail the failure", async () => {
            const built = await build()
            built.log.mockRejectedValue(new RangeError("log"))
            built.post.mockRejectedValue(new RangeError("office"))
            built.mark.mockRejectedValue(new RangeError("inbound"))

            await built.service.failed(ctx, itemOf(), "boom")

            expect(built.error.mock.calls.map(([event]) => event)).toEqual([
                WorkEngineLogEvent.EvidenceFailed,
                WorkEngineLogEvent.OfficeFailed,
                WorkEngineLogEvent.InboundStatusFailed,
            ])
        })
    })
})
