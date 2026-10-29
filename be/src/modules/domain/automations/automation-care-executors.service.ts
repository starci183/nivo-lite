import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { RunResult, RunStep } from "@modules/domain/automation-runs"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AutomationMessagesService } from "./automation-messages.service"
import type { AutomationOffice, ExecutorContext, ExecutorMap, ExecutorPayload } from "./automation-ports.contracts"
import { InjectAutomationOffice } from "./automations.decorators"
import { WorkItemsActivityService } from "@modules/domain/work-items"
import { AutomationReadsService } from "./automation-reads.service"
import { instantOf, vndText } from "./policies/format.policy"
import { DAY_MS, textOf } from "./policies/trigger.policy"

const TEN_MINUTES_MS = 600_000
const TWENTY_MINUTES_MS = 1_200_000
const AFTER_HOURS_CALLBACK_UTC_HOUR = 2
const OFFICE_EXCERPT = 160

@Injectable()
/**
 * The executors that look after customers: thank a payment, ask for a review, nudge a quiet lead, invite a past customer back, remind
 * a debt, answer after hours. Each does ONE thing and reports steps and evidence; whatever reaches a customer goes through the gate.
 */
export class AutomationCareExecutorsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectAutomationOffice() private readonly office: AutomationOffice,
        private readonly messages: AutomationMessagesService,
        private readonly work: WorkItemsActivityService,
        private readonly reads: AutomationReadsService,
    ) {}

    /** The executors of the templates this service runs, by template key. */
    executors(): ExecutorMap {
        return {
            thank_payment: (context, payload) => this.thankPayment(context, payload),
            ask_review: (context, payload) => this.askReview(context, payload),
            nurture_leads: (context, payload) => this.nurtureLead(context, payload),
            win_back: (context, payload) => this.winBack(context, payload),
            debt_reminder: (context, payload) => this.debtReminder(context, payload),
            after_hours: (context, payload) => this.afterHours(context, payload),
        }
    }

    private async thankPayment(context: ExecutorContext, payload: ExecutorPayload): Promise<RunResult> {
        const leadId = textOf(payload.lead_id)
        const amount = Number(payload.amount_vnd) || 0
        const minimum = Number(context.config.minAmount) || 0
        const say = (key: string, params = {}): string => this.messages.say(key, params)
        if (amount < minimum) {
            return this.messages.skipped(
                say("thank.belowMinimum", { amount: vndText(amount), minimum: vndText(minimum) }),
            )
        }
        const lead = await this.messages.leadOf(context.workspaceId, leadId)
        if (lead === null) return this.messages.skipped(say("thank.noLead"))
        const conversation = await this.messages.conversationOf(context.workspaceId, lead.id)
        if (conversation === null) return this.messages.noChannel(lead.contact_name)
        // NIVO's own care message after a payment already thanked this customer: do not say it twice.
        const thankedAt = instantOf(textOf(payload.at))
        const since = new Date(
            Number.isNaN(thankedAt) ? this.clock.now().getTime() - TWENTY_MINUTES_MS : thankedAt - TEN_MINUTES_MS,
        ).toISOString()
        const existing = await this.work.builtInCareOf(context.workspaceId, lead.id, since, this.entityManager)
        if (existing !== null) {
            const step: RunStep = {
                label: say("step.skipped"),
                status: "skipped",
                detail: say("thank.alreadyThanked"),
                workItemId: existing,
            }
            return { status: "skipped", steps: [step] }
        }
        return this.messages.composeAndSend(context, {
            action: "send_care",
            lead,
            conversationId: conversation.id,
            dedupe: `thank:${textOf(payload.invoice_id) || leadId}`,
            summary: say("thank.summary", { name: lead.contact_name, amount: vndText(amount) }),
            caseNote: say("thank.case", { amount: vndText(amount) }),
            vars: { ten_khach: lead.contact_name, so_tien: vndText(amount), ma_phieu: textOf(payload.invoice_no) },
            forceAsk: false,
        })
    }

    private async askReview(context: ExecutorContext, payload: ExecutorPayload): Promise<RunResult> {
        const lead = await this.messages.leadOf(context.workspaceId, textOf(payload.lead_id))
        if (lead === null) return this.messages.skipped(this.messages.say("review.noLead"))
        const conversation = await this.messages.conversationOf(context.workspaceId, lead.id)
        if (conversation === null) return this.messages.noChannel(lead.contact_name)
        return this.messages.composeAndSend(context, {
            action: "send_care",
            lead,
            conversationId: conversation.id,
            dedupe: `review:${textOf(payload.invoice_id) || lead.id}`,
            summary: this.messages.say("review.summary", { name: lead.contact_name }),
            caseNote: this.messages.say("review.case"),
            vars: {
                ten_khach: lead.contact_name,
                so_tien: vndText(Number(payload.amount_vnd) || 0),
                ma_phieu: textOf(payload.invoice_no),
            },
            forceAsk: false,
        })
    }

    private async nurtureLead(context: ExecutorContext, payload: ExecutorPayload): Promise<RunResult> {
        const lead = await this.messages.leadOf(context.workspaceId, textOf(payload.lead_id))
        if (lead === null || ["won", "lost"].includes(lead.stage)) {
            return this.messages.skipped(this.messages.say("nurture.closed"))
        }
        const conversation = await this.messages.conversationOf(context.workspaceId, lead.id)
        if (conversation === null) return this.messages.noChannel(lead.contact_name)
        const k = textOf(payload.k)
        return this.messages.composeAndSend(context, {
            action: "send_follow_up",
            lead,
            conversationId: conversation.id,
            dedupe: textOf(payload.dedupe) || `nurture:${lead.id}:${k}`,
            summary: this.messages.say("nurture.summary", { k, name: lead.contact_name }),
            caseNote: this.messages.say("nurture.case", { need: lead.need, k }),
            vars: { ten_khach: lead.contact_name, nhu_cau: lead.need },
            forceAsk: false,
        })
    }

    private async winBack(context: ExecutorContext, payload: ExecutorPayload): Promise<RunResult> {
        const lead = await this.messages.leadOf(context.workspaceId, textOf(payload.lead_id))
        if (lead === null || lead.stage === "lost") return this.messages.skipped(this.messages.say("winback.gone"))
        const conversation = await this.messages.conversationOf(context.workspaceId, lead.id)
        if (conversation === null) return this.messages.noChannel(lead.contact_name)
        const offer = textOf(context.config.offer)
        return this.messages.composeAndSend(context, {
            action: "send_follow_up",
            lead,
            conversationId: conversation.id,
            dedupe: textOf(payload.dedupe),
            summary: this.messages.say(offer ? "winback.summaryOffer" : "winback.summary", {
                name: lead.contact_name,
                offer,
            }),
            caseNote: this.messages.say("winback.case", { offer: offer || this.messages.say("winback.noOffer") }),
            vars: { ten_khach: lead.contact_name, nhu_cau: lead.need, uu_dai: offer },
            forceAsk: true,
        })
    }

    private async debtReminder(context: ExecutorContext, payload: ExecutorPayload): Promise<RunResult> {
        const lead = await this.messages.leadOf(context.workspaceId, textOf(payload.lead_id))
        const say = (key: string, params = {}): string => this.messages.say(key, params)
        if (lead === null) return this.messages.skipped(say("debt.noLead"))
        const k = Number(payload.k) || 1
        const amount = vndText(Number(payload.amount_vnd) || 0)
        const invoice = textOf(payload.invoice_no)
        const conversation = await this.messages.conversationOf(context.workspaceId, lead.id)
        const steps: Array<RunStep> = []
        if (k >= 2) {
            await this.office.postLine(
                context.workspaceId,
                say("debt.ownerLine", { k, name: lead.contact_name, amount, invoice }),
                lead.id,
            )
            await this.office.logEvidence(context.workspaceId, {
                leadId: lead.id,
                kind: "automation.owner_notified",
                actor: say("debt.actor"),
                summary: say("debt.ownerEvidence", { k, name: lead.contact_name }),
                evidence: invoice,
            })
            steps.push({ label: say("step.ownerNotified"), status: "done", detail: say("debt.reminderNumber", { k }) })
        }
        if (conversation === null) {
            const skipped: RunStep = {
                label: say("step.skipped"),
                status: "skipped",
                detail: say("debt.noChat", { name: lead.contact_name }),
            }
            return { status: steps.length > 0 ? "done" : "skipped", steps: [...steps, skipped] }
        }
        const sent = await this.messages.composeAndSend(context, {
            action: "send_care",
            lead,
            conversationId: conversation.id,
            dedupe: textOf(payload.dedupe),
            summary: say("debt.summary", { amount, name: lead.contact_name }),
            caseNote: say("debt.case", { invoice, k }),
            vars: { ten_khach: lead.contact_name, so_tien: amount, ma_phieu: invoice },
            forceAsk: false,
        })
        return { ...sent, steps: [...steps, ...sent.steps] }
    }

    private async afterHours(context: ExecutorContext, payload: ExecutorPayload): Promise<RunResult> {
        const say = (key: string, params = {}): string => this.messages.say(key, params)
        const conversation = await this.reads.conversation(context.workspaceId, textOf(payload.conversation_id))
        if (conversation === undefined) return this.messages.skipped(say("after.noConversation"))
        if (conversation.handled_by) return this.messages.skipped(say("after.handled"))
        const lead = await this.messages.leadOf(
            context.workspaceId,
            textOf(payload.lead_id) || conversation.lead_id || "",
        )
        const name = lead?.contact_name ?? conversation.visitor_name ?? say("customer")
        const dedupe = textOf(payload.dedupe)
        const sent =
            lead === null
                ? await this.messages.replyWithoutLead(context, { conversationId: conversation.id, name, dedupe })
                : await this.messages.composeAndSend(context, {
                      action: "reply_customer",
                      lead,
                      conversationId: conversation.id,
                      dedupe,
                      summary: say("after.summary", { name }),
                      caseNote: say("after.case"),
                      vars: { ten_khach: name },
                      forceAsk: false,
                  })
        const steps: Array<RunStep> = [...sent.steps]
        if (lead !== null) {
            // A call-back task for staff: tomorrow morning, Vietnam time.
            const callback = new Date(this.clock.now().getTime() + DAY_MS)
            callback.setUTCHours(AFTER_HOURS_CALLBACK_UTC_HOUR, 0, 0, 0)
            const staff = (await this.messages.firstStaffName(context.workspaceId)) ?? say("after.staffFallback")
            await this.office.openFollowUp(context.workspaceId, {
                leadId: lead.id,
                title: say("after.taskTitle", { name }),
                ownerName: staff,
                nextAction: say(lead.phone ? "after.taskActionPhone" : "after.taskAction", {
                    name,
                    phone: lead.phone ?? "",
                }),
                dueAt: callback.toISOString(),
            })
            steps.push({ label: say("after.taskStep"), status: "done", detail: say("after.taskDetail", { staff }) })
        }
        await this.office.postLine(
            context.workspaceId,
            say("after.officeLine", { name, text: textOf(payload.text).slice(0, OFFICE_EXCERPT) }),
            lead?.id ?? null,
        )
        steps.push({ label: say("after.officeStep"), status: "done" })
        return { status: sent.status, steps, evidence: sent.evidence ?? null }
    }
}
