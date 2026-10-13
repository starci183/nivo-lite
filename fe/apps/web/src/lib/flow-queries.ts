import "server-only"
import { cache } from "react"
import { drainAfter, engineCtx } from "./flow-ctx"
import type { EngineCtx } from "./engine"
import { listModules, MODULE_KEYS } from "./module-registry"
import { governanceFrom, isTestRunName, toDecision } from "./governance"
import type { DecisionDb, GovernanceRows, GovernanceWithStatus } from "./governance"
import type {
    Authority,
    AuthorityRule,
    DecisionRow,
    Department,
    InboundEvent,
    Invoice,
    LeadFlow,
    Order,
    ReasonCode,
    Staff,
    Transaction,
    WorkItem,
    WorkItemView,
    WorkStatus,
} from "./flow-types"

const DAY = 86_400_000
const WORK_SELECT = "*, lead:leads(id, contact_name, company, channel), staff:staff(name)"

type WorkRow = WorkItem & {
    lead: WorkItemView["lead"]
    staff: { name: string } | null
    decisions?: Array<{ decided_by: string; created_at: string }>
}

const WORK_SELECT_WITH_DECIDER = `${WORK_SELECT}, decisions(decided_by, created_at)`

const toView = ({ staff, decisions, ...w }: WorkRow): WorkItemView => ({
    ...w,
    proposal: w.proposal ?? { summary: "", fields: {} },
    lead: w.lead ?? null,
    assignedStaffName: staff?.name ?? null,
    hasApprovalCard: w.execution_id !== null,
    href: w.lead_id
        ? `/leads/${w.lead_id}`
        : w.department === "inventory"
          ? "/agents/inventory/workbench?tab=orders"
          : w.department === "shifts"
            ? "/agents/shifts/workbench"
            : "/chat",
    ...(decisions
        ? {
              decidedBy:
                  [...decisions].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1)?.decided_by ?? null,
          }
        : {}),
})

/** The owner's authority (goals, policies, reply style, brand voice, limits note). */
export const getAuthority = cache(async (): Promise<Authority> => {
    const { db, ws } = await engineCtx()
    const { data } = await db.from("authority").select("*").eq("workspace_id", ws).maybeSingle()
    return (
        (data as Authority | null) ?? {
            workspace_id: ws,
            goal_revenue_vnd: null,
            goal_new_customers: null,
            goal_first_reply_minutes: null,
            goal_note: "",
            policies: "",
            reply_style: "",
            brand_voice: "",
            limits_note: "",
            updated_by: null,
            updated_at: new Date().toISOString(),
        }
    )
})

/** Department position = the module registry order (every module, future ones included); an unknown department sorts last. */
const DEPARTMENT_ORDER: ReadonlyMap<string, number> = new Map(MODULE_KEYS.map((k, i) => [k as string, i]))
const rank = (department: string): number => DEPARTMENT_ORDER.get(department) ?? MODULE_KEYS.length
/** Action position inside its department = the order of the module's authorityActions in the registry. */
const ACTION_ORDER: ReadonlyMap<string, number> = new Map(
    listModules().flatMap((m) => m.authorityActions.map((a, i) => [`${m.key}.${a.action}`, i] as const)),
)
const actionRank = (r: { department: string; action: string }): number =>
    ACTION_ORDER.get(`${r.department}.${r.action}`) ?? Number.MAX_SAFE_INTEGER

/** Department × action rules, grouped Chatbot → Sales → Accounting in flow order. */
export const listRules = cache(async (): Promise<Array<AuthorityRule>> => {
    const { db, ws } = await engineCtx()
    const { data } = await db.from("authority_rules").select("*").eq("workspace_id", ws)
    return ((data ?? []) as Array<AuthorityRule>).sort(
        (a, b) =>
            rank(a.department) - rank(b.department) ||
            actionRank(a) - actionRank(b) ||
            a.action.localeCompare(b.action),
    )
})

/** Optional staff (active first). */
export const listStaff = cache(async (): Promise<Array<Staff>> => {
    const { db, ws } = await engineCtx()
    const { data } = await db
        .from("staff")
        .select("*")
        .eq("workspace_id", ws)
        .order("active", { ascending: false })
        .order("created_at")
    return (data ?? []) as Array<Staff>
})

/** Latest inputs first. */
export const listInbound = async (limit = 30): Promise<Array<InboundEvent>> => {
    const { db, ws } = await engineCtx()
    const { data } = await db
        .from("inbound_events")
        .select("*")
        .eq("workspace_id", ws)
        .order("created_at", { ascending: false })
        .limit(limit)
    return (data ?? []) as Array<InboundEvent>
}

/** Items waiting for a decision plus failed ones, oldest first. `hasApprovalCard` = a legacy approval card already shows it. */
export const listExceptions = cache(async (): Promise<Array<WorkItemView>> => {
    const c = await engineCtx()
    drainAfter(c)
    const { data } = await c.db
        .from("work_items")
        .select(WORK_SELECT)
        .eq("workspace_id", c.ws)
        .in("status", ["waiting_decision", "failed"])
        .order("created_at")
        .limit(100)
    return workViewsFrom((data ?? []) as Array<WorkRow>)
})

/** Work items as the app shows them, from rows already read (the SQL page functions return the same shape, lead and staff embedded). */
export const workViewsFrom = (rows: ReadonlyArray<unknown>): Array<WorkItemView> => (rows as Array<WorkRow>).map(toView)

/** Work items, newest first (or in flow order for one lead). */
export const listWorkItems = async (
    filter: { status?: Array<WorkStatus>; leadId?: string; limit?: number; withDecider?: boolean } = {},
): Promise<Array<WorkItemView>> => {
    const { db, ws } = await engineCtx()
    let q = db
        .from("work_items")
        .select(filter.withDecider ? WORK_SELECT_WITH_DECIDER : WORK_SELECT)
        .eq("workspace_id", ws)
    if (filter.status?.length) q = q.in("status", filter.status)
    if (filter.leadId) q = q.eq("lead_id", filter.leadId)
    const { data } = await q.order("created_at", { ascending: !!filter.leadId }).limit(filter.limit ?? 50)
    return ((data ?? []) as unknown as Array<WorkRow>).map(toView)
}

/** Decision history: policy (NIVO) and human decisions, newest first. kind: policy | human | rejected. */
export const listDecisions = async (
    filter: { kind?: "policy" | "human" | "rejected"; department?: Department; limit?: number } = {},
): Promise<Array<DecisionRow>> => {
    const { db, ws } = await engineCtx()
    let q = db.from("decisions").select("*, lead:leads(contact_name)").eq("workspace_id", ws)
    if (filter.kind === "policy") q = q.eq("decider_kind", "policy")
    if (filter.kind === "human") q = q.in("decider_kind", ["owner", "staff"])
    if (filter.kind === "rejected") q = q.eq("outcome", "rejected")
    if (filter.department) q = q.eq("department", filter.department)
    const { data } = await q.order("created_at", { ascending: false }).limit(filter.limit ?? 100)
    return ((data ?? []) as Array<DecisionDb>).map(toDecision)
}


const fetchGovernanceRows = async (db: EngineCtx["db"], ws: string, since7: string): Promise<GovernanceRows> => {
    const [auth, leadsQ, orders, invoices, txs, work, pendingEx, decisions7, recent] = await Promise.all([
        db
            .from("authority")
            .select("goal_revenue_vnd, goal_new_customers, goal_first_reply_minutes")
            .eq("workspace_id", ws)
            .maybeSingle(),
        db
            .from("leads")
            .select("id, contact_name, company, origin, stage, created_at")
            .eq("workspace_id", ws)
            .limit(10000),
        db
            .from("orders")
            .select("id, lead_id, order_no, items, amount_vnd, status, origin")
            .eq("workspace_id", ws)
            .in("status", ["confirmed", "invoiced", "paid"]),
        db
            .from("invoices")
            .select("id, order_id, lead_id, invoice_no, amount_vnd, status, origin")
            .eq("workspace_id", ws)
            .in("status", ["issued", "paid"]),
        db
            .from("transactions")
            .select("id, invoice_id, payer, reference, amount_vnd, status, origin")
            .eq("workspace_id", ws)
            .in("status", ["matched", "unmatched", "needs_review"]),
        db
            .from("work_items")
            .select(
                "id, lead_id, department, status, reason, decided_path, created_at, updated_at, completed_at, summary:proposal->>summary, contact:proposal->fields->>contact_name, customer:proposal->fields->>customer",
            )
            .eq("workspace_id", ws)
            .order("created_at", { ascending: false })
            .limit(2000),
        db
            .from("executions")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", ws)
            .eq("status", "pending_approval")
            .is("work_item_id", null),
        db
            .from("decisions")
            .select("work_item_id, lead_id, decider_kind, outcome, created_at")
            .eq("workspace_id", ws)
            .gte("created_at", since7),
        db
            .from("decisions")
            .select("*, lead:leads(contact_name)")
            .eq("workspace_id", ws)
            .order("created_at", { ascending: false })
            .limit(40),
    ])
    return {
        auth: (auth.data as GovernanceRows["auth"]) ?? null,
        leads: leadsQ.data ?? [],
        orders: orders.data ?? [],
        invoices: invoices.data ?? [],
        txs: txs.data ?? [],
        work: work.data ?? [],
        pending_without_work: pendingEx.count ?? 0,
        decisions7: decisions7.data ?? [],
        recent: recent.data ?? [],
    }
}

export const getGovernance = cache(async (): Promise<GovernanceWithStatus> => {
    const c = await engineCtx()
    drainAfter(c)
    const since7 = new Date(Date.now() - 7 * DAY).toISOString()
    return governanceFrom(await fetchGovernanceRows(c.db, c.ws, since7), since7)
})


/** One customer's flow: work items in order, orders, invoices, payments and decisions. */
export const getLeadFlow = async (leadId: string): Promise<LeadFlow> => {
    const { db, ws } = await engineCtx()
    const [work, orders, invoices, decisions] = await Promise.all([
        db.from("work_items").select(WORK_SELECT).eq("workspace_id", ws).eq("lead_id", leadId).order("created_at"),
        db.from("orders").select("*").eq("workspace_id", ws).eq("lead_id", leadId).order("created_at"),
        db.from("invoices").select("*").eq("workspace_id", ws).eq("lead_id", leadId).order("created_at"),
        db
            .from("decisions")
            .select("*, lead:leads(contact_name)")
            .eq("workspace_id", ws)
            .eq("lead_id", leadId)
            .order("created_at"),
    ])
    const inv = (invoices.data ?? []) as Array<Invoice>
    const tx = inv.length
        ? (((
              await db
                  .from("transactions")
                  .select("*")
                  .eq("workspace_id", ws)
                  .in(
                      "invoice_id",
                      inv.map((x) => x.id),
                  )
                  .order("created_at")
          ).data ?? []) as Array<Transaction>)
        : []
    return {
        workItems: ((work.data ?? []) as Array<WorkRow>).map(toView),
        orders: (orders.data ?? []) as Array<Order>,
        invoices: inv,
        transactions: tx,
        decisions: ((decisions.data ?? []) as Array<DecisionDb>).map(toDecision),
    }
}

export { TEST_RUN_PATTERN, governanceFrom, isTestRunName, isTestRunWorkItem } from "./governance"
export type { GovernanceRows, GovernanceWithStatus, OriginSplit, StatusFigure, StatusResults } from "./governance"
