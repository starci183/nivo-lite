"use server"
import "server-only"

import { isTestRunName, listDecisions, listWorkItems } from "@/lib/flow-queries"
import type { SalesWorkbenchData } from "@/modules/types"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { toLeadRecord, toResponsibilityRecord } from "../leads/leads.mapper"
import { toContract } from "../contracts/contracts.mapper"
import { toInvoice, toOrder } from "../orders/orders.mapper"
import { autoDoneItemsOf, buildSalesWorkbench, conversationIdsOf } from "./sales.mapper"

const LEADS_LIMIT = 500
const STEPS_LIMIT = 500
const ORDERS_LIMIT = 200
const INVOICES_LIMIT = 500
const CONVERSATIONS_LIMIT = 200
const DRAFTS_LIMIT = 50
const STAFF_LIMIT = 200
const OUTCOMES_LIMIT = 600
const CONTRACTS_LIMIT = 300
const MESSAGES_LIMIT = 800
const EVIDENCE_LIMIT = 200
const WORK_ITEMS_LIMIT = 400
const DECIDED_LIMIT = 15

/** The flow work items and the human decisions of Sales; a failed read is a typed failure, never an empty list. */
const readFlow = async (): Promise<
    DbOutcome<readonly [Awaited<ReturnType<typeof listWorkItems>>, Awaited<ReturnType<typeof listDecisions>>]>
> => {
    try {
        return dbOk([
            await listWorkItems({ limit: WORK_ITEMS_LIMIT }),
            await listDecisions({ kind: "human", department: "sales", limit: DECIDED_LIMIT }),
        ] as const)
    } catch (cause) {
        return dbFailure("unavailable", cause instanceof Error ? cause.message : "flow")
    }
}

/** Reads the records of one workspace under the caller's RLS plus the flow's work items and derives the whole Sales workbench from them. */
export const readSalesWorkbench = async (workspaceId: string): Promise<DbOutcome<SalesWorkbenchData>> => {
    const client = await createServerDbClient()
    const [leadsR, stepsR, ordersR, invoicesR, conversationsR, draftsR, staffR, outcomesR, contractsR] =
        await Promise.all([
            client
                .from("leads")
                .select("*")
                .eq("workspace_id", workspaceId)
                .order("created_at", { ascending: false })
                .limit(LEADS_LIMIT),
            client
                .from("responsibilities")
                .select("*")
                .eq("workspace_id", workspaceId)
                .neq("status", "done")
                .order("due_at", { ascending: true, nullsFirst: false })
                .limit(STEPS_LIMIT),
            client
                .from("orders")
                .select("*")
                .eq("workspace_id", workspaceId)
                .neq("status", "draft")
                .order("created_at", { ascending: false })
                .limit(ORDERS_LIMIT),
            client.from("invoices").select("*").eq("workspace_id", workspaceId).limit(INVOICES_LIMIT),
            client
                .from("agent_conversations")
                .select("id, lead_id, handled_by")
                .eq("workspace_id", workspaceId)
                .eq("kind", "customer")
                .not("lead_id", "is", null)
                .limit(CONVERSATIONS_LIMIT),
            client
                .from("executions")
                .select("id, responsibility_id, draft, created_at")
                .eq("workspace_id", workspaceId)
                .eq("status", "pending_approval")
                .is("work_item_id", null)
                .limit(DRAFTS_LIMIT),
            client
                .from("staff")
                .select("id, name")
                .eq("workspace_id", workspaceId)
                .eq("active", true)
                .order("created_at")
                .limit(STAFF_LIMIT),
            client
                .from("events")
                .select("lead_id, evidence, created_at")
                .eq("workspace_id", workspaceId)
                .eq("kind", "outcome.recorded")
                .order("created_at", { ascending: false })
                .limit(OUTCOMES_LIMIT),
            client
                .from("contracts")
                .select("*")
                .eq("workspace_id", workspaceId)
                .order("ends_on", { ascending: true })
                .limit(CONTRACTS_LIMIT),
        ])
    const leads = toOutcome(leadsR)
    if (leads.kind !== "ok") return leads
    const steps = toOutcome(stepsR)
    if (steps.kind !== "ok") return steps
    const orders = toOutcome(ordersR)
    if (orders.kind !== "ok") return orders
    const invoices = toOutcome(invoicesR)
    if (invoices.kind !== "ok") return invoices
    const conversations = toOutcome(conversationsR)
    if (conversations.kind !== "ok") return conversations
    const drafts = toOutcome(draftsR)
    if (drafts.kind !== "ok") return drafts
    const staff = toOutcome(staffR)
    if (staff.kind !== "ok") return staff
    const outcomes = toOutcome(outcomesR)
    if (outcomes.kind !== "ok") return outcomes
    const contracts = toOutcome(contractsR)
    if (contracts.kind !== "ok") return contracts

    const flow = await readFlow()
    if (flow.kind !== "ok") return flow
    const [items, decided] = flow.value

    const conversationIds = conversationIdsOf(conversations.value)
    const autoDoneIds = autoDoneItemsOf(items).map((item) => item.id)
    const [messagesR, evidenceR] = await Promise.all([
        client
            .from("agent_messages")
            .select("conversation_id, role, body, created_at")
            .in("conversation_id", conversationIds)
            .order("created_at", { ascending: false })
            .limit(MESSAGES_LIMIT),
        client
            .from("events")
            .select("work_item_id, evidence")
            .in("work_item_id", autoDoneIds)
            .eq("kind", "work.auto_done")
            .limit(EVIDENCE_LIMIT),
    ])
    const messages = toOutcome(messagesR)
    if (messages.kind !== "ok") return messages
    const autoEvidence = toOutcome(evidenceR)
    if (autoEvidence.kind !== "ok") return autoEvidence

    return dbOk(
        buildSalesWorkbench({
            nowMs: Date.now(),
            leads: leads.value.map(toLeadRecord),
            steps: steps.value.map(toResponsibilityRecord),
            orders: orders.value.map(toOrder),
            invoices: invoices.value.map(toInvoice),
            conversations: conversations.value,
            messages: messages.value,
            drafts: drafts.value,
            staff: staff.value,
            outcomes: outcomes.value,
            items,
            decided,
            autoEvidence: autoEvidence.value,
            contracts: contracts.value.map(toContract),
            isTestRun: isTestRunName,
        }),
    )
}
