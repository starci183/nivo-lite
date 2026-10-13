import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { ActionPerformer } from "@modules/domain/module-ops"
import type { WorkContext, WorkItem, WorkPerformer } from "./decisions.contracts"
import { ModulePerformersService } from "./module-performers.service"
import { WORK_PERFORMER_REGISTRY } from "./work-performer.port"
import type { WorkPerformerRegistry } from "./work-performer.port"

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "hiring",
    action: "send_offer",
    subject_type: "inbound",
    subject_id: "cand-1",
    lead_id: null,
    inbound_event_id: null,
    parent_id: null,
    chain_id: null,
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: "over_authority",
    reasons: ["over_authority"],
    missing_fields: [],
    proposal: { summary: "Offer", fields: { offer_id: "o1" } },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: "2026-10-12T10:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "vi" }

interface Built {
    readonly subject: ModulePerformersService
    readonly add: jest.Mock
    readonly engine: () => WorkPerformer | undefined
}

const setup = async (): Promise<Built> => {
    let captured: WorkPerformer | undefined
    const add = jest.fn((_action: string, performer: WorkPerformer) => {
        captured = performer
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModulePerformersService,
            { provide: WORK_PERFORMER_REGISTRY, useValue: mock<WorkPerformerRegistry>({ add }) },
        ],
    }).compile()
    return { subject: moduleRef.get(ModulePerformersService), add, engine: () => captured }
}

describe("ModulePerformersService", () => {
    it("registers each module performer with the work engine and keeps it for lookups", async () => {
        const { subject, add } = await setup()
        const performer: ActionPerformer = { action: "send_offer", perform: jest.fn() }

        subject.add(performer)

        expect(add).toHaveBeenCalledWith("send_offer", expect.any(Object))
        expect(subject.performersOf("send_offer")).toEqual([performer])
        expect(subject.performersOf("other")).toEqual([])
    })

    it("maps the engine perform to the module performer with the person's draft and facts", async () => {
        const { subject, engine } = await setup()
        const perform = jest.fn().mockResolvedValue({ summary: "Sent", evidence: "captured", detail: "letter" })
        subject.add({ action: "send_offer", perform })

        const done = await engine()?.perform(
            ctx,
            itemOf(),
            { summary: "Offer", draft: "edited", fields: { offer_id: "o1" } },
            { name: "Binh", kind: "owner" },
        )

        expect(perform).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            workItemId: "item-1",
            actor: "Binh",
            draft: "edited",
            fields: { offer_id: "o1" },
        })
        expect(done).toEqual({ summary: "Sent", evidence: "captured", lead_id: null, detail: "letter" })
    })

    it("runs the module undo when a person rejects", async () => {
        const { subject, engine } = await setup()
        const reject = jest.fn().mockResolvedValue(undefined)
        subject.add({ action: "send_offer", perform: jest.fn(), reject })

        await engine()?.onReject?.(ctx, itemOf(), itemOf().proposal, { name: "Binh" })

        expect(reject).toHaveBeenCalledWith(expect.objectContaining({ workItemId: "item-1", actor: "Binh" }))
    })
})
