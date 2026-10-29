import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DecisionHistoryService } from "./decision-history.service"
import type { DecisionHistoryFilter } from "./decision-history.service"
import { DecisionEntity } from "./persistence/entities"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"

const filterOf = builder<DecisionHistoryFilter>({ deciders: null, outcome: null, department: null, limit: 10 })

const loggedOf = builder({
    id: "decision-1",
    work_item_id: "work-1",
    lead_id: "lead-1" as string | null,
    department: "sales",
    action: "send_quote",
    decided_by: "Mai",
    decidedByMemberId: "member-1",
    decider_kind: "owner",
    outcome: "approved",
    reason: "over_authority",
    note: "Looks right",
    created_at: "2026-10-15T09:15:00.000Z",
    sort_key: "20261015091500.000000",
})

const requestOf = builder({
    id: "request-1",
    lead_id: "lead-2",
    department: "accounting",
    action: "pay_bill",
    decided_by: "NIVO",
    decidedByMemberId: null,
    decider_kind: "policy",
    outcome: "expired",
    note: "",
    created_at: "2026-10-16T09:15:00.000Z",
    sort_key: "20261016091500.000000",
})

const taskOf = builder({
    id: "chain-1",
    lead_id: null,
    department: "office",
    decided_by: "Binh",
    decidedByMemberId: "member-2",
    decider_kind: "staff",
    note: "call back",
    created_at: "2026-10-14T09:15:00.000Z",
    sort_key: "20261014091500.000000",
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [DecisionHistoryService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(DecisionHistoryService)
}

describe("DecisionHistoryService", () => {
    describe("list", () => {
        it("merges the three sources newest first, tags the derived lines and names the customers once", async () => {
            const logged = loggedOf()
            const request = requestOf()
            const task = taskOf()
            const em = mockEntityManager()
            const [logRead, requestRead, taskRead, leadRead] = queueQueryBuilders(em, [
                { getRawMany: [logged] },
                { getRawMany: [request] },
                { getRawMany: [task] },
                {
                    getRawMany: [
                        { id: "lead-1", name: "Lan" },
                        { id: "lead-2", name: null },
                    ],
                },
            ])
            const service = await build(em)

            const { sort_key: _loggedKey, ...loggedLine } = logged
            const { sort_key: _requestKey, ...requestLine } = request
            const { sort_key: _taskKey, ...taskLine } = task
            await expect(service.list("workspace-1", filterOf())).resolves.toEqual([
                {
                    ...requestLine,
                    work_item_id: null,
                    reason: "over_authority",
                    leadName: null,
                },
                { ...loggedLine, leadName: "Lan" },
                {
                    ...taskLine,
                    work_item_id: null,
                    action: "thread_task",
                    outcome: "completed",
                    reason: null,
                    leadName: null,
                },
            ])

            expect(em.createQueryBuilder).toHaveBeenNthCalledWith(1, DecisionEntity, "d")
            expect(logRead?.callsOf("where")).toEqual([
                ["d.workspaceId = :workspaceId", { workspaceId: "workspace-1" }],
            ])
            expect(logRead?.callsOf("andWhere")).toEqual([])
            expect(logRead?.callsOf("orderBy")).toEqual([["d.createdAt", "DESC"]])
            expect(logRead?.callsOf("addOrderBy")).toEqual([["d.id", "DESC"]])
            expect(logRead?.callsOf("limit")).toEqual([[10]])
            expect(requestRead?.callsOf("from")).toEqual([["public.approval_requests", "r"]])
            expect(requestRead?.callsOf("where")).toEqual([
                ["r.workspace_id = :workspaceId AND r.status <> 'pending'", { workspaceId: "workspace-1" }],
            ])
            expect(requestRead?.callsOf("orderBy")).toEqual([["COALESCE(r.resolved_at, r.created_at)", "DESC"]])
            expect(requestRead?.callsOf("limit")).toEqual([[10]])
            expect(taskRead?.callsOf("from")).toEqual([["public.work_chains", "c"]])
            expect(taskRead?.callsOf("where")).toEqual([
                [
                    "c.workspace_id = :workspaceId AND c.kind IN ('hand_off', 'assign') AND c.status = 'done'",
                    { workspaceId: "workspace-1" },
                ],
            ])
            expect(taskRead?.callsOf("orderBy")).toEqual([["COALESCE(c.finished_at, c.started_at)", "DESC"]])
            expect(taskRead?.callsOf("limit")).toEqual([[10]])
            expect(leadRead?.callsOf("from")).toEqual([["public.leads", "l"]])
            expect(leadRead?.callsOf("where")).toEqual([["l.id IN (:...leadIds)", { leadIds: ["lead-2", "lead-1"] }]])
        })

        it("orders lines of one instant by id descending and keeps only the newest limit lines", async () => {
            const em = mockEntityManager()
            const [, , , leadRead] = queueQueryBuilders(em, [
                {
                    getRawMany: [
                        loggedOf({ id: "decision-a" }),
                        loggedOf({ id: "decision-c" }),
                        loggedOf({ id: "decision-b" }),
                    ],
                },
                { getRawMany: [] },
                { getRawMany: [] },
                { getRawMany: [{ id: "lead-1", name: "Lan" }] },
            ])
            const service = await build(em)

            const lines = await service.list("workspace-1", filterOf({ limit: 2 }))

            expect(lines.map((line) => line.id)).toEqual(["decision-c", "decision-b"])
            expect(leadRead?.callsOf("where")).toEqual([["l.id IN (:...leadIds)", { leadIds: ["lead-1"] }]])
        })

        it("skips the customer read when no line has a customer", async () => {
            const em = mockEntityManager()
            queueQueryBuilders(em, [
                { getRawMany: [loggedOf({ lead_id: null })] },
                { getRawMany: [] },
                { getRawMany: [] },
            ])
            const service = await build(em)

            const lines = await service.list("workspace-1", filterOf())

            expect(lines.map((line) => [line.id, line.leadName])).toEqual([["decision-1", null]])
            expect(em.createQueryBuilder).toHaveBeenCalledTimes(3)
        })

        it("narrows the log and the requests by decider, outcome and module and leaves out the tasks of another outcome", async () => {
            const em = mockEntityManager()
            const [logRead, requestRead] = queueQueryBuilders(em, [{ getRawMany: [] }, { getRawMany: [] }])
            const service = await build(em)

            await expect(
                service.list(
                    "workspace-1",
                    filterOf({ deciders: ["owner", "staff"], outcome: "approved", department: "sales", limit: 5 }),
                ),
            ).resolves.toEqual([])

            expect(em.createQueryBuilder).toHaveBeenCalledTimes(2)
            expect(logRead?.callsOf("andWhere")).toEqual([
                ["d.deciderKind IN (:...deciders)", { deciders: ["owner", "staff"] }],
                ["d.outcome = :outcome", { outcome: "approved" }],
                ["d.department = :department", { department: "sales" }],
            ])
            expect(logRead?.callsOf("limit")).toEqual([[5]])
            expect(requestRead?.callsOf("andWhere")).toEqual([
                [
                    "(r.status = 'expired' OR NOT EXISTS (SELECT 1 FROM public.thread_work w WHERE w.approval_request_id = r.id))",
                ],
                [
                    "(CASE WHEN m.id IS NULL THEN 'policy' WHEN m.role = 'owner' THEN 'owner' ELSE 'staff' END) IN (:...deciders)",
                    { deciders: ["owner", "staff"] },
                ],
                ["r.status = :outcome", { outcome: "approved" }],
                ["r.department = :department", { department: "sales" }],
            ])
        })

        it("reads the tasks for the completed outcome, narrowed by decider and module only", async () => {
            const task = taskOf()
            const em = mockEntityManager()
            const [, , taskRead] = queueQueryBuilders(em, [
                { getRawMany: [] },
                { getRawMany: [] },
                { getRawMany: [task] },
            ])
            const service = await build(em)

            const lines = await service.list(
                "workspace-1",
                filterOf({ deciders: ["staff"], outcome: "completed", department: "office" }),
            )

            expect(lines.map((line) => line.id)).toEqual(["chain-1"])
            expect(taskRead?.callsOf("andWhere")).toEqual([
                ["NOT EXISTS (SELECT 1 FROM public.thread_work w WHERE w.thread_id = c.thread_id)"],
                [
                    "(CASE WHEN m.role = 'owner' THEN 'owner' ELSE 'staff' END) IN (:...deciders)",
                    { deciders: ["staff"] },
                ],
                ["COALESCE(a.module, 'office') = :department", { department: "office" }],
            ])
        })
    })
})
