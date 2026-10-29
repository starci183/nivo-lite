import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DecisionEntity } from "./persistence/entities"
import { WorkItemViewsService } from "./work-item-views.service"
import type { WorkItemViewFilter } from "./work-item-views.service"
import { fakeQueryBuilder, queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"

const filterOf = builder<WorkItemViewFilter>({ statuses: [], after: null, action: null, limit: 20 })

const rowOf = builder<Record<string, unknown>>({
    id: "work-1",
    workspace_id: "workspace-1",
    department: "sales",
    action: "send_quote",
    status: "waiting_decision",
    created_at: "2026-10-15T09:15:00.123456Z",
    cursor_at: "2026-10-15T09:15:00.123456Z",
    decidedBy: "Mai",
})

const ITEM_COLUMNS = [
    "workspace_id",
    "department",
    "action",
    "subject_type",
    "subject_id",
    "lead_id",
    "inbound_event_id",
    "parent_id",
    "chain_id",
    "depth",
    "status",
    "decided_path",
    "reason",
    "reasons",
    "missing_fields",
    "proposal",
    "result",
    "error",
    "evidence_state",
    "assigned_staff_id",
    "execution_id",
    "installation_id",
]

const itemSelects = [
    ["w.id", "id"],
    ...ITEM_COLUMNS.map((column) => [`w.${column}`, column]),
    ...["created_at", "updated_at", "completed_at"].map((column) => [`to_json(w.${column}) #>> '{}'`, column]),
]

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [WorkItemViewsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(WorkItemViewsService)
}

describe("WorkItemViewsService", () => {
    describe("find", () => {
        it("reads one item of the workspace with its cursor and latest decider, naming the decider twice", async () => {
            const row = rowOf()
            const em = mockEntityManager()
            const [read] = queueQueryBuilders(em, [{ getRawOne: row }])
            const service = await build(em)

            await expect(service.find("workspace-1", "work-1")).resolves.toEqual({ ...row, deciderName: "Mai" })

            expect(read?.callsOf("from")).toEqual([["public.work_items", "w"]])
            expect(read?.callsOf("select")).toEqual([["w.id", "id"]])
            expect(read?.callsOf("addSelect").slice(0, itemSelects.length - 1)).toEqual(itemSelects.slice(1))
            expect(read?.callsOf("addSelect")[itemSelects.length - 1]).toEqual([
                "to_json(w.created_at) #>> '{}'",
                "cursor_at",
            ])
            expect(read?.callsOf("where")).toEqual([
                [
                    "w.workspace_id = :workspaceId AND w.id = :workItemId",
                    { workspaceId: "workspace-1", workItemId: "work-1" },
                ],
            ])
            expect(read?.callsOf("limit")).toEqual([[1]])
        })

        it("selects the name of the latest decision as a subquery", async () => {
            const em = mockEntityManager()
            const [read] = queueQueryBuilders(em, [{ getRawOne: rowOf() }])
            const service = await build(em)
            await service.find("workspace-1", "work-1")
            const latest = fakeQueryBuilder()

            const subquery = read?.callsOf("addSelect").at(-1)
            expect(subquery?.[1]).toBe("decidedBy")
            expect(typeof subquery?.[0]).toBe("function")
            Reflect.apply(subquery?.[0] as (builder: object) => unknown, undefined, [latest.builder])

            expect(latest.calls).toEqual([
                { method: "select", args: ["d.decidedBy"] },
                { method: "from", args: [DecisionEntity, "d"] },
                { method: "where", args: ["d.workspaceId = w.workspace_id AND d.workItemId = w.id"] },
                { method: "orderBy", args: ["d.createdAt", "DESC"] },
                { method: "addOrderBy", args: ["d.id", "DESC"] },
                { method: "limit", args: [1] },
            ])
        })

        it("answers undefined when the workspace has no such item", async () => {
            const em = mockEntityManager()
            queueQueryBuilders(em, [{ getRawOne: undefined }])
            const service = await build(em)

            await expect(service.find("workspace-1", "work-9")).resolves.toBeUndefined()
        })

        it("gives a null decider name when the row has no latest decision", async () => {
            const row = rowOf({ decidedBy: undefined })
            const em = mockEntityManager()
            queueQueryBuilders(em, [{ getRawOne: row }])
            const service = await build(em)

            await expect(service.find("workspace-1", "work-1")).resolves.toEqual({ ...row, deciderName: null })
        })
    })

    describe("list", () => {
        it("reads the newest page of the workspace when nothing narrows it", async () => {
            const newest = rowOf()
            const older = rowOf({ id: "work-0", decidedBy: null })
            const em = mockEntityManager()
            const [read] = queueQueryBuilders(em, [{ getRawMany: [newest, older] }])
            const service = await build(em)

            await expect(service.list("workspace-1", filterOf())).resolves.toEqual([
                { ...newest, deciderName: "Mai" },
                { ...older, deciderName: null },
            ])

            expect(read?.callsOf("where")).toEqual([["w.workspace_id = :workspaceId", { workspaceId: "workspace-1" }]])
            expect(read?.callsOf("andWhere")).toEqual([])
            expect(read?.callsOf("orderBy")).toEqual([["w.created_at", "DESC"]])
            expect(read?.callsOf("addOrderBy")).toEqual([["w.id", "DESC"]])
            expect(read?.callsOf("limit")).toEqual([[20]])
        })

        it("narrows by status, keyset position and action", async () => {
            const em = mockEntityManager()
            const [read] = queueQueryBuilders(em, [{ getRawMany: [] }])
            const service = await build(em)

            await expect(
                service.list(
                    "workspace-1",
                    filterOf({
                        statuses: ["waiting_decision", "failed"],
                        after: { createdAt: "2026-10-15T09:15:00.123456Z", id: "work-5" },
                        action: "send_quote",
                        limit: 5,
                    }),
                ),
            ).resolves.toEqual([])

            expect(read?.callsOf("andWhere")).toEqual([
                ["w.status IN (:...statuses)", { statuses: ["waiting_decision", "failed"] }],
                [
                    "(w.created_at, w.id) < (CAST(:afterCreatedAt AS timestamptz), CAST(:afterId AS uuid))",
                    { afterCreatedAt: "2026-10-15T09:15:00.123456Z", afterId: "work-5" },
                ],
                ["w.action = :action", { action: "send_quote" }],
            ])
            expect(read?.callsOf("limit")).toEqual([[5]])
        })
    })

    describe("accountingWaiting", () => {
        it("reads the oldest waiting accounting items and folds the customer columns into lead", async () => {
            const item = rowOf({ department: "accounting", assigned_staff_name: "Binh" })
            const withLead = {
                ...item,
                lead_row_id: "lead-1",
                lead_contact_name: "Lan",
                lead_company: "Hoa Sen",
                lead_channel: "zalo",
            }
            const withoutLead = {
                ...item,
                id: "work-2",
                lead_row_id: null,
                lead_contact_name: "",
                lead_company: "",
                lead_channel: "",
            }
            const em = mockEntityManager()
            const [read] = queueQueryBuilders(em, [{ getRawMany: [withLead, withoutLead] }])
            const service = await build(em)

            await expect(service.accountingWaiting("workspace-1", 7)).resolves.toEqual([
                { ...item, lead: { id: "lead-1", contact_name: "Lan", company: "Hoa Sen", channel: "zalo" } },
                { ...item, id: "work-2", lead: null },
            ])

            expect(read?.callsOf("from")).toEqual([["public.work_items", "w"]])
            expect(read?.callsOf("select")).toEqual([["w.id", "id"]])
            expect(read?.callsOf("addSelect")).toEqual([
                ...itemSelects.slice(1),
                ["l.id", "lead_row_id"],
                ["l.contact_name", "lead_contact_name"],
                ["l.company", "lead_company"],
                ["l.channel", "lead_channel"],
                ["s.name", "assigned_staff_name"],
            ])
            expect(read?.callsOf("leftJoin")).toEqual([
                ["leads", "l", "l.id = w.lead_id AND l.workspace_id = w.workspace_id"],
                ["staff", "s", "s.id = w.assigned_staff_id AND s.workspace_id = w.workspace_id"],
            ])
            expect(read?.callsOf("where")).toEqual([
                [
                    "w.workspace_id = :workspaceId AND w.department = 'accounting' AND w.status = 'waiting_decision'",
                    { workspaceId: "workspace-1" },
                ],
            ])
            expect(read?.callsOf("orderBy")).toEqual([["w.created_at", "ASC"]])
            expect(read?.callsOf("addOrderBy")).toEqual([["w.id", "ASC"]])
            expect(read?.callsOf("limit")).toEqual([[7]])
        })
    })
})
