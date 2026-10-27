import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { RunResult, RunStep } from "@modules/domain/automation-runs"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AutomationMessagesService } from "./automation-messages.service"
import { AutomationRenewalPaymentService } from "./automation-renewal-payment.service"
import type {
    AutomationOffice,
    AutomationOwnerChat,
    AutomationRecords,
    ExecutorContext,
    ExecutorMap,
    ExecutorPayload,
} from "./automation-ports.contracts"
import { InjectAutomationOffice, InjectAutomationOwnerChat, InjectAutomationRecords } from "./automations.decorators"
import { SELECT_CONTRACT, SELECT_DAY_FIGURES, SELECT_ORDER } from "./persistence/automation-readers.sql"
import type { ContractReadRow, DayFiguresRow, OrderReadRow } from "./persistence/automations.rows"
import { dayText, instantOf, vndText } from "./policies/format.policy"
import { vnClock } from "./policies/hours.policy"
import { DAY_MS, textOf } from "./policies/trigger.policy"

const RENEWAL_FOLLOW_UP_DAYS = 2
const WAITING_LISTED = 3
const WAITING_EXCERPT = 90
const NO_FIGURES: DayFiguresRow = {
    new_leads: 0,
    confirmed_orders: 0,
    confirmed_total: 0,
    money_in: 0,
    won_leads: 0,
    waiting: [],
}

@Injectable()
/**
 * The executors that run the shop's day: the end-of-day report, the delivery notice, the contract renewal reminder.
 * Each does ONE thing and reports steps and evidence; whatever reaches a customer goes through the gate.
 */
export class AutomationOperationsExecutorsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectAutomationOffice() private readonly office: AutomationOffice,
        @InjectAutomationRecords() private readonly records: AutomationRecords,
        @InjectAutomationOwnerChat() private readonly ownerChat: AutomationOwnerChat,
        private readonly messages: AutomationMessagesService,
        private readonly renewalPayment: AutomationRenewalPaymentService,
    ) {}

    /** The executors of the templates this service runs, by template key. */
    executors(): ExecutorMap {
        return {
            daily_report: (context, payload) => this.dailyReport(context, payload),
            delivery_notice: (context, payload) => this.deliveryNotice(context, payload),
            contract_renewal: (context, payload) => this.contractRenewal(context, payload),
        }
    }

    /** The end-of-day report, posted to Office (and to the owner's chat when the template asks for it). */
    private async dailyReport(context: ExecutorContext, payload: ExecutorPayload): Promise<RunResult> {
        const say = this.messages.say.bind(this.messages)
        const day = textOf(payload.day) || vnClock(this.clock.now()).day
        const [row] = await this.entityManager.query<Array<DayFiguresRow>>(SELECT_DAY_FIGURES, [
            context.workspaceId,
            new Date(`${day}T00:00:00+07:00`).toISOString(),
        ])
        const figures = row ?? NO_FIGURES
        const deals = Math.max(figures.won_leads, figures.confirmed_orders)
        const waiting = figures.waiting.map((summary) => (summary ?? "").slice(0, WAITING_EXCERPT))
        const text = [
            say("report.title", { day: dayText(day), shop: context.shop.shop }),
            say("report.newLeads", { count: figures.new_leads }),
            figures.confirmed_orders > 0
                ? say("report.dealsTotal", { count: deals, total: vndText(Number(figures.confirmed_total)) })
                : say("report.deals", { count: deals }),
            say("report.moneyIn", { amount: vndText(Number(figures.money_in)) }),
            waiting.length > 0
                ? say("report.waitingSome", { count: waiting.length }) +
                  waiting
                      .slice(0, WAITING_LISTED)
                      .map((summary) => `\n   - ${summary}`)
                      .join("")
                : say("report.waitingNone"),
        ].join("\n")
        await this.office.postLine(context.workspaceId, text, null)
        const steps: Array<RunStep> = [{ label: say("report.posted"), status: "done", message: text }]
        if (context.config.toOwnerChat === true) {
            const reached = await this.ownerChat.sendToOwner(context.workspaceId, text)
            steps.push(
                reached
                    ? { label: say("report.chatSent"), status: "done" }
                    : { label: say("report.chatSkipped"), status: "skipped", detail: say("report.chatSkippedDetail") },
            )
        }
        return {
            status: "done",
            steps,
            evidence: say("report.evidence", {
                leads: figures.new_leads,
                deals,
                money: vndText(Number(figures.money_in)),
                waiting: waiting.length,
            }),
        }
    }

    /** Tells the customer an order left with a carrier and gives the tracking code. */
    private async deliveryNotice(context: ExecutorContext, payload: ExecutorPayload): Promise<RunResult> {
        const say = this.messages.say.bind(this.messages)
        const orderId = textOf(payload.order_id)
        const [order] = orderId
            ? await this.entityManager.query<Array<OrderReadRow>>(SELECT_ORDER, [context.workspaceId, orderId])
            : []
        if (!order?.shipped_at) return this.messages.skipped(say("delivery.notShipped"))
        const lead = await this.messages.leadOf(context.workspaceId, order.lead_id ?? "")
        if (lead === null) return this.messages.skipped(say("delivery.noLead", { order: order.order_no }))
        const conversation = await this.messages.conversationOf(context.workspaceId, lead.id)
        if (conversation === null) return this.messages.skipped(say("delivery.noChat", { name: lead.contact_name }))
        const carrier = (order.carrier ?? "").trim()
        const tracking = (order.tracking_code ?? "").trim()
        return this.messages.composeAndSend(context, {
            action: "send_care",
            lead,
            conversationId: conversation.id,
            dedupe: `ship:${order.id}`,
            summary: say("delivery.summary", {
                name: lead.contact_name,
                order: order.order_no,
                carrier: carrier || say("delivery.carrierFallback"),
            }),
            caseNote: say(tracking ? "delivery.caseTracking" : "delivery.case", {
                order: order.order_no,
                carrier: carrier || say("delivery.carrierCaseFallback"),
                tracking,
            }),
            vars: {
                ten_khach: lead.contact_name,
                ma_phieu: order.order_no,
                hang_van_chuyen: carrier,
                ma_van_don: tracking,
            },
            forceAsk: false,
        })
    }

    /**
     * Drafts a renewal message (the owner decides by default) and opens a follow-up for sales. A contract with an amount gets its
     * renewal invoice for the period, and the message carries the invoice, the amount, the transfer content and a VietQR link.
     */
    private async contractRenewal(context: ExecutorContext, payload: ExecutorPayload): Promise<RunResult> {
        const say = this.messages.say.bind(this.messages)
        const contractId = textOf(payload.contract_id)
        const [contract] = contractId
            ? await this.entityManager.query<Array<ContractReadRow>>(SELECT_CONTRACT, [context.workspaceId, contractId])
            : []
        if (contract?.status !== "active") return this.messages.skipped(say("renewal.gone"))
        if (textOf(payload.ends_on) && contract.ends_on !== textOf(payload.ends_on)) {
            return this.messages.skipped(say("renewal.moved"))
        }
        const ends = dayText(contract.ends_on)
        const plan = contract.plan.trim() || say("renewal.planFallback")
        // A contract typed in by name only gets an open lead now, so sales can follow the renewal.
        const leadId = contract.lead_id ?? (await this.createRenewalLead(context.workspaceId, contract, plan))
        const lead = await this.messages.lead(context.workspaceId, leadId)
        if (lead === null) return this.messages.skipped(say("renewal.noLead"))
        const payment = await this.renewalPayment.paymentOf(context.workspaceId, contract, lead.id, context.body)
        const steps: Array<RunStep> = [...(payment?.steps ?? [])]
        let status: RunResult["status"] = "done"
        let evidence: string | null | undefined = null
        const conversation = await this.messages.conversationOf(context.workspaceId, lead.id)
        if (conversation === null) {
            steps.push({
                label: say("renewal.notMessaged"),
                status: "skipped",
                detail: say("renewal.notMessagedDetail", { name: lead.contact_name }),
            })
        } else {
            steps.push(...(await this.renewalPayment.zaloWindowSteps(conversation)))
            const sent = await this.messages.composeAndSend(context, {
                action: "send_follow_up",
                lead,
                conversationId: conversation.id,
                dedupe: `renew:${contract.id}:${contract.ends_on}`,
                summary: say("renewal.summary", { name: lead.contact_name, plan, ends }),
                caseNote: say("renewal.case", { plan, ends }),
                vars: { ten_khach: lead.contact_name, ten_goi: plan, ngay_het_han: ends, ...payment?.vars },
                forceAsk: context.config.alwaysAsk !== false,
                fixedTail: payment?.fixedTail,
                keepExact: payment?.keepExact,
            })
            steps.push(...sent.steps)
            status = sent.status
            evidence = sent.evidence
        }
        const owner = (await this.messages.firstStaffName(context.workspaceId)) ?? say("after.staffFallback")
        const due = this.renewalDue(contract.ends_on)
        const opened = await this.office.openFollowUp(context.workspaceId, {
            leadId: lead.id,
            title: say("renewal.taskTitle", { plan, name: lead.contact_name, ends }),
            ownerName: owner,
            nextAction: say(lead.phone ? "renewal.taskActionPhone" : "renewal.taskAction", {
                name: lead.contact_name,
                phone: lead.phone ?? "",
                plan,
                ends,
            }),
            dueAt: due.toISOString(),
        })
        if (opened) {
            steps.push({
                label: say("renewal.taskStep"),
                status: "done",
                detail: say("renewal.taskDetail", { staff: owner, ends }),
            })
            await this.office.postLine(
                context.workspaceId,
                say("renewal.officeLine", { plan, name: lead.contact_name, ends }),
                lead.id,
            )
        }
        await this.office.logEvidence(context.workspaceId, {
            leadId: lead.id,
            kind: "automation.contract_renewal",
            actor: this.messages.actorOf(context.def),
            summary: say("renewal.evidenceSummary", { plan, name: lead.contact_name }),
            evidence: [contract.id, contract.ends_on, payment?.invoiceNo].filter(Boolean).join(":"),
        })
        return { status, steps, evidence }
    }

    private async createRenewalLead(workspaceId: string, contract: ContractReadRow, plan: string): Promise<string> {
        const leadId = await this.records.createLead(workspaceId, {
            contactName: contract.customer_name,
            channel: this.messages.say("renewal.channel"),
            need: this.messages.say("renewal.need", { plan }),
            stage: "qualified",
        })
        await this.records.attachContractLead(workspaceId, contract.id, leadId)
        return leadId
    }

    private renewalDue(endsOn: string): Date {
        return new Date(
            Math.min(
                instantOf(`${endsOn}T00:00:00+07:00`),
                this.clock.now().getTime() + RENEWAL_FOLLOW_UP_DAYS * DAY_MS,
            ),
        )
    }
}
