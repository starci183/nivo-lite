import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import type { GateSubmission } from "@modules/domain/automations"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AutomationGateService } from "./automation-gate.service"

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_follow_up",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: "over_authority",
    reasons: ["over_authority"],
    missing_fields: [],
    proposal: { summary: "Follow up An", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-13T09:00:00.000Z",
    updated_at: "2026-10-13T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const submissionOf = builder<GateSubmission>({
    workspaceId: "ws-1",
    actor: "Nurture",
    action: "send_follow_up",
    subject: { type: "lead", id: "lead-1" },
    leadId: "lead-1",
    dedupeKey: "automation:p-1:d-1",
    summary: "Follow up An",
    draft: "Hello An",
    fields: { customer: "An", contact: "0900" },
    forceAsk: false,
    autoApprove: false,
})

const setup = async (asked: WorkItem) => {
    const engine = mock<WorkEngineService>()
    engine.runWork.mockResolvedValue(asked)
    engine.resumeWork.mockResolvedValue(
        itemOf({ status: "done", reason: null, reasons: [], result: { summary: "Sent to An" } }),
    )
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key: string) => key)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationGateService,
            { provide: WorkEngineService, useValue: engine },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { subject: moduleRef.get(AutomationGateService), engine }
}

describe("AutomationGateService", () => {
    it("puts the message through the engine as a preset item and answers it waiting", async () => {
        const { subject, engine } = await setup(itemOf())

        await expect(subject.submit(submissionOf())).resolves.toEqual({
            itemId: "item-1",
            state: "waiting",
            summary: null,
            reason: "over_authority",
            error: null,
            autoApproved: false,
        })
        expect(engine.runWork).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "Nurture", locale: "vi" },
            {
                action: "send_follow_up",
                subject_type: "lead",
                subject_id: "lead-1",
                lead_id: "lead-1",
                dedupeKey: "automation:p-1:d-1",
                preset: true,
                noChain: true,
                seed: { summary: "Follow up An", draft: "Hello An", fields: { customer: "An", contact: "0900" } },
            },
        )
        expect(engine.resumeWork).not.toHaveBeenCalled()
    })

    it("approves on the owner's behalf when only the rule asks and the owner let it send by itself", async () => {
        const { subject, engine } = await setup(itemOf())

        await expect(subject.submit(submissionOf({ autoApprove: true }))).resolves.toMatchObject({
            state: "sent",
            summary: "Sent to An",
            autoApproved: true,
        })
        expect(engine.resumeWork).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "Nurture", locale: "vi" },
            "item-1",
            "approved",
            {},
            { name: "automationPorts.autoSendBy", kind: "owner" },
            "automationPorts.autoSendNote",
        )
    })

    it("keeps a forced ask waiting even when the owner let it send by itself", async () => {
        const { subject, engine } = await setup(itemOf())

        await expect(subject.submit(submissionOf({ forceAsk: true, autoApprove: true }))).resolves.toMatchObject({
            state: "waiting",
            autoApproved: false,
        })
        expect(engine.runWork).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ forceAsk: "over_authority" }),
        )
        expect(engine.resumeWork).not.toHaveBeenCalled()
    })

    it("does not approve an item that also misses data", async () => {
        const { subject, engine } = await setup(itemOf({ reasons: ["over_authority", "missing_data"] }))

        await expect(subject.submit(submissionOf({ autoApprove: true }))).resolves.toMatchObject({ state: "waiting" })
        expect(engine.resumeWork).not.toHaveBeenCalled()
    })

    it("answers a rejected and a failed item by their state", async () => {
        const rejected = await setup(itemOf({ status: "rejected" }))
        await expect(rejected.subject.submit(submissionOf())).resolves.toMatchObject({ state: "rejected" })

        const failed = await setup(itemOf({ status: "failed", error: "No channel" }))
        await expect(failed.subject.submit(submissionOf())).resolves.toMatchObject({
            state: "failed",
            error: "No channel",
        })
    })
})
