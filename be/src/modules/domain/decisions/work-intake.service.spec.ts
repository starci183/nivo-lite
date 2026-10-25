import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkItemsService } from "@modules/domain/work-items"
import type { NewWorkItem } from "@modules/domain/work-items"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { ActionEntry, WorkContext, WorkItem, WorkSpec } from "./decisions.contracts"
import { DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import { ModuleCatalogService } from "./module-catalog.service"
import { WorkIntakeService } from "./work-intake.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_quote",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: "2026-10-12T10:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const actionOf = builder<ActionEntry>({
    action: "send_quote",
    moduleKey: "sales",
    maxMode: null,
    next: [],
    label: { vi: "Gui bao gia", en: "Send quote" },
})

const specOf = builder<WorkSpec>({
    action: "send_quote",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    dedupeKey: "send_quote:lead-1",
})

interface Rows {
    readonly inserted?: WorkItem | null
    readonly existing?: WorkItem | null
    readonly action?: ActionEntry | null
}

const build = async (rows: Rows = {}) => {
    const evidence = mock<EvidenceService>({ log: jest.fn().mockResolvedValue(undefined) })
    const insert = jest.fn().mockResolvedValue(rows.inserted === undefined ? itemOf() : rows.inserted)
    const findByDedupe = jest.fn().mockResolvedValue(rows.existing === undefined ? null : rows.existing)
    const action = rows.action === undefined ? actionOf() : rows.action
    const modules = mock<ModuleCatalogService>({ actionOf: jest.fn().mockResolvedValue(action) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkIntakeService,
            {
                provide: MESSAGE_CATALOG,
                useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => `text:${key}`) }),
            },
            { provide: WorkItemsService, useValue: mock<WorkItemsService>({ insert, findByDedupe }) },
            {
                provide: ModuleCatalogService,
                useValue: modules,
            },
            { provide: EvidenceService, useValue: evidence },
        ],
    }).compile()
    return { service: moduleRef.get(WorkIntakeService), evidence, insert, findByDedupe, modules }
}

describe("WorkIntakeService", () => {
    it("inserts the queued item with the department of the action", async () => {
        const { service, insert } = await build()

        const result = await service.insert(
            ctx,
            specOf({
                seed: { summary: "Quote" },
                chainId: "chain-1",
                depth: 2,
                inbound_event_id: "in-1",
                parent_id: "p-1",
                installationId: "inst-1",
            }),
        )

        expect(result.created).toBe(true)
        expect(result.item.id).toBe("item-1")
        expect(insert).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                chainId: "chain-1",
                depth: 2,
                department: "sales",
                action: "send_quote",
                subjectType: "lead",
                subjectId: "lead-1",
                leadId: "lead-1",
                inboundEventId: "in-1",
                parentId: "p-1",
                dedupeKey: "send_quote:lead-1",
                proposal: { summary: "Quote", fields: {} },
                installationId: "inst-1",
            } satisfies NewWorkItem,
            undefined,
        )
    })

    it("starts a new chain at depth 0 when the spec names none", async () => {
        const { service, insert } = await build()

        await service.insert(ctx, specOf({ subject_id: undefined, lead_id: undefined }))

        expect(insert).toHaveBeenCalledWith(
            expect.objectContaining({
                chainId: null,
                depth: 0,
                subjectId: null,
                leadId: null,
                inboundEventId: null,
                parentId: null,
                installationId: null,
                proposal: { summary: "", fields: {} },
            }),
            undefined,
        )
    })

    it("calls onInserted once with the new item", async () => {
        const { service } = await build()
        const seen: Array<WorkItem> = []

        await service.insert(ctx, specOf({ onInserted: (row) => Promise.resolve(void seen.push(row)) }))

        expect(seen.map((row) => row.id)).toEqual(["item-1"])
    })
})

describe("WorkIntakeService", () => {
    it("answers the existing item and logs the duplicate when the key was used", async () => {
        const { service, evidence, findByDedupe } = await build({ inserted: null, existing: itemOf({ id: "old" }) })
        const seen: Array<WorkItem> = []

        const result = await service.insert(ctx, specOf({ onInserted: (row) => Promise.resolve(void seen.push(row)) }))

        expect(result.created).toBe(false)
        expect(result.item.id).toBe("old")
        expect(seen).toEqual([])
        expect(findByDedupe).toHaveBeenCalledWith("ws-1", "send_quote:lead-1", undefined)
        expect(evidence.log).toHaveBeenCalledWith(
            ctx,
            {
                lead_id: "lead-1",
                work_item_id: "old",
                kind: "core.duplicate_blocked",
                actor: "NIVO",
                summary: "text:engine.duplicate",
                evidence: "send_quote:lead-1",
            },
            undefined,
        )
    })

    it("is not found when the key is used but the item cannot be read", async () => {
        const { service } = await build({ inserted: null, existing: null })

        await expect(service.insert(ctx, specOf())).rejects.toThrow(DecisionsErrorCode.NotFound)
    })

    it("refuses an action that is not in the registry", async () => {
        const { service } = await build({ action: null })

        await expect(service.insert(ctx, specOf())).rejects.toThrow(DecisionsErrorCode.UnknownAction)
    })

    it("inserts the exact durable execution choices through the supplied transaction", async () => {
        const { service, insert, modules } = await build()
        const manager = mockEntityManager()

        await service.insert(
            ctx,
            specOf({
                seed: { summary: "API message", draft: "Exact API text" },
                preset: true,
                noChain: true,
                forceAsk: "over_authority",
            }),
            manager,
        )
        expect(modules.actionOf).toHaveBeenCalledWith("send_quote", manager)

        expect(insert).toHaveBeenCalledWith(
            expect.objectContaining({
                proposal: {
                    summary: "API message",
                    fields: {},
                    draft: "Exact API text",
                    execution: { preset: true, noChain: true, forceAsk: "over_authority" },
                },
            }),
            manager,
        )
    })

    it("uses the supplied transaction for duplicate lookup and evidence", async () => {
        const { service, evidence, findByDedupe } = await build({ inserted: null, existing: itemOf() })
        const manager = mockEntityManager()

        expect((await service.insert(ctx, specOf(), manager)).created).toBe(false)

        expect(findByDedupe).toHaveBeenCalledWith("ws-1", "send_quote:lead-1", manager)
        expect(evidence.log).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({ kind: "core.duplicate_blocked" }),
            manager,
        )
    })
})
