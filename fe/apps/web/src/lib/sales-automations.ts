import "server-only"
import { logEvidence } from "./core"
import { vnClock } from "./automation-hours"
import {
    actorOf,
    composeAndSend,
    customerConversation,
    loadLead,
    postOffice,
    str,
    type Db,
    type Executor,
    type RunResult,
    type StepEx,
} from "./automation-runs"
import type { PipelineConfig } from "./automation-shared"
import { daysLeft, dayText, type Contract } from "./sales-contracts-shared"
import { emitEvent } from "./outbound-events"
import type { Order } from "./flow-types"

/**
 * The Sales automations (resources/automation-templates/delivery_notice.json and contract_renewal.json). They decide WHO to message and WHEN; the words
 * come from the owner's approved body and every customer message leaves through the authority gate (composeAndSend).
 *   delivery_notice   event order.shipped (the workbench action "Đánh dấu đã giao cho vận chuyển"): tell the customer the carrier and the tracking code.
 *   contract_renewal  event contract.expiring (emitted by the daily tick N days before ends_on): draft a renewal message (asks the owner by default)
 *                     and open a follow-up for sales.
 */
const skipped = (detail: string): RunResult => ({
    status: "skipped",
    steps: [{ label: "Bỏ qua", status: "skipped", detail }],
})
const DAY = 86_400_000

/* ------------------------------------------------------------------ delivery_notice */

export const deliveryNotice: Executor = async (x, p) => {
    const orderId = str(p.order_id)
    const order = orderId
        ? (((await x.db.from("orders").select("*").eq("workspace_id", x.ws).eq("id", orderId).maybeSingle()).data ??
              null) as Order | null)
        : null
    if (!order || !order.shipped_at) return skipped("Đơn này không còn hoặc chưa được đánh dấu đã giao đi.")
    const lead = order.lead_id ? await loadLead(x.db, x.ws, order.lead_id) : null
    if (!lead) return skipped(`Đơn ${order.order_no} chưa gắn với khách nào.`)
    const conv = await customerConversation(x.db, x.ws, lead.id)
    if (!conv) return skipped(`${lead.contact_name} chưa có cuộc trò chuyện nào để NIVO nhắn lại.`)
    const carrier = (order.carrier ?? "").trim()
    const tracking = (order.tracking_code ?? "").trim()
    return composeAndSend(x, {
        action: "send_care",
        lead,
        conversationId: conv.id,
        dedupe: `ship:${order.id}`,
        summary: `Báo ${lead.contact_name} đơn ${order.order_no} đã giao cho ${carrier || "vận chuyển"}`,
        caseNote: `Đơn ${order.order_no} vừa giao cho ${carrier || "đơn vị vận chuyển"}${tracking ? `, mã vận đơn ${tracking}` : ""}.`,
        vars: {
            ten_khach: lead.contact_name,
            ma_phieu: order.order_no,
            hang_van_chuyen: carrier,
            ma_van_don: tracking,
        },
    })
}

/* ------------------------------------------------------------------ contract_renewal */

export const contractRenewal: Executor = async (x, p) => {
    const id = str(p.contract_id)
    const c = id
        ? (((await x.db.from("contracts").select("*").eq("workspace_id", x.ws).eq("id", id).maybeSingle()).data ??
              null) as Contract | null)
        : null
    if (!c || c.status !== "active") return skipped("Hợp đồng không còn hiệu lực hoặc đã bị xoá.")
    if (str(p.ends_on) && c.ends_on !== str(p.ends_on))
        return skipped("Ngày hết hạn đã được đổi (gia hạn), nên không nhắc theo hạn cũ.")
    const endText = dayText(c.ends_on)
    const planText = c.plan.trim() || "dịch vụ"

    // The follow-up needs a customer record: a contract typed in by name only gets one now (an open lead, so sales can follow the renewal).
    let leadId = c.lead_id
    if (!leadId) {
        const ins = await x.db
            .from("leads")
            .insert({
                workspace_id: x.ws,
                contact_name: c.customer_name,
                company: "—",
                channel: "Hợp đồng",
                need: `Gia hạn hợp đồng ${planText}`,
                stage: "qualified",
                origin: "live",
            })
            .select("id")
            .single()
        if (ins.error) throw new Error(ins.error.message)
        leadId = (ins.data as { id: string }).id
        await x.db
            .from("contracts")
            .update({ lead_id: leadId, updated_at: new Date().toISOString() })
            .eq("id", c.id)
            .eq("workspace_id", x.ws)
    }
    const lead = await loadLead(x.db, x.ws, leadId)
    if (!lead) return skipped("Không tìm thấy khách của hợp đồng này.")

    const steps: Array<StepEx> = []
    let status: RunResult["status"] = "done"
    let evidence: string | null = null
    const conv = await customerConversation(x.db, x.ws, lead.id)
    if (conv) {
        const sent = await composeAndSend(x, {
            action: "send_follow_up",
            forceAsk: x.config.alwaysAsk !== false,
            lead,
            conversationId: conv.id,
            dedupe: `renew:${c.id}:${c.ends_on}`,
            summary: `Nhắc ${lead.contact_name} gia hạn hợp đồng ${planText} (hết hạn ${endText})`,
            caseNote: `Hợp đồng ${planText} của khách hết hạn ngày ${endText}.`,
            vars: { ten_khach: lead.contact_name, ten_goi: planText, ngay_het_han: endText },
        })
        steps.push(...sent.steps)
        status = sent.status
        evidence = sent.evidence ?? null
    } else {
        steps.push({
            label: "Chưa nhắn khách",
            status: "skipped",
            detail: `${lead.contact_name} chưa có cuộc trò chuyện nào để NIVO nhắn; việc liên hệ khách đã giao cho nhân viên.`,
        })
    }

    // The follow-up work item for sales (a responsibility, shown in the workbench and Office).
    const title = `Gia hạn hợp đồng ${planText} · ${lead.contact_name} (hết hạn ${endText})`
    const open = await x.db
        .from("responsibilities")
        .select("id")
        .eq("workspace_id", x.ws)
        .eq("lead_id", lead.id)
        .eq("title", title)
        .neq("status", "done")
        .limit(1)
    if (!((open.data ?? []) as Array<unknown>).length) {
        const staff = ((
            await x.db
                .from("staff")
                .select("id, name")
                .eq("workspace_id", x.ws)
                .eq("active", true)
                .order("created_at")
                .limit(1)
        ).data ?? [])[0] as { id: string; name: string } | undefined
        const due = new Date(Math.min(Date.parse(`${c.ends_on}T00:00:00+07:00`), Date.now() + 2 * DAY))
        await x.db.from("responsibilities").insert({
            workspace_id: x.ws,
            lead_id: lead.id,
            title,
            owner_kind: "human",
            owner_name: staff?.name ?? "Nhân viên",
            next_action: `Liên hệ ${lead.contact_name}${lead.phone ? ` (${lead.phone})` : ""} để chốt gia hạn hợp đồng ${planText} trước ngày ${endText}.`,
            due_at: due.toISOString(),
        })
        steps.push({
            label: "Đã tạo việc theo dõi gia hạn cho bán hàng",
            status: "done",
            detail: `${staff?.name ?? "Nhân viên"} · hết hạn ${endText}`,
        })
        await postOffice(
            x.db,
            x.ws,
            `Hợp đồng ${planText} của ${lead.contact_name} hết hạn ngày ${endText}. NIVO đã soạn tin gia hạn và tạo việc theo dõi.`,
            lead.id,
        )
    }
    await logEvidence(x.db, x.ws, {
        lead_id: lead.id,
        kind: "automation.contract_renewal",
        actor: actorOf(x.def),
        summary: `Nhắc gia hạn hợp đồng ${planText} của ${lead.contact_name}`,
        evidence: `${c.id}:${c.ends_on}`,
    })
    return { status, steps, evidence }
}

/* ------------------------------------------------------------------ the daily scan */

/**
 * Called by the minute tick for an enabled contract_renewal pipeline: every active contract ending within `beforeDays` days (and not yet over) that this
 * pipeline has not announced for its current end date gets ONE contract.expiring event (emitEvent -> onBusinessEvent -> a run). Changing the end date
 * (a renewal) changes the dedupe key, so the next term is announced again.
 */
export const scanContracts = async (
    db: Db,
    pipeline: { readonly id: string; readonly ws: string; readonly config: PipelineConfig },
    now: Date,
    batch: number,
): Promise<number> => {
    const today = vnClock(now).day
    const before = Math.max(1, Math.min(90, Number(pipeline.config.beforeDays) || 14))
    const horizon = new Date(Date.parse(`${today}T00:00:00Z`) + before * DAY).toISOString().slice(0, 10)
    const { data } = await db
        .from("contracts")
        .select("id, ends_on")
        .eq("workspace_id", pipeline.ws)
        .eq("status", "active")
        .gte("ends_on", today)
        .lte("ends_on", horizon)
        .order("ends_on")
        .limit(100)
    const due = (data ?? []) as Array<{ id: string; ends_on: string }>
    if (!due.length) return 0
    const seen = new Set(
        (
            ((
                await db
                    .from("automation_runs")
                    .select("dedupe_key")
                    .eq("pipeline_id", pipeline.id)
                    .in(
                        "trigger_ref",
                        due.map((d) => d.id),
                    )
            ).data ?? []) as Array<{ dedupe_key: string }>
        ).map((r) => r.dedupe_key),
    )
    let started = 0
    for (const c of due) {
        if (started >= batch) break
        const dedupe = `contract.expiring:${c.id}:${c.ends_on}`
        if (seen.has(`renew:${dedupe}`)) continue
        await emitEvent(
            pipeline.ws,
            "contract.expiring",
            { contract_id: c.id, ends_on: c.ends_on, days_left: daysLeft(c.ends_on, today) },
            dedupe,
        )
        started += 1
    }
    return started
}

export const SALES_EXECUTORS: Readonly<Record<string, Executor>> = {
    delivery_notice: deliveryNotice,
    contract_renewal: contractRenewal,
}
