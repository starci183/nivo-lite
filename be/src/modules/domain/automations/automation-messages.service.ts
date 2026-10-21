import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { RunResult, RunStep } from "@modules/domain/automation-runs"
import type { TemplateDefinition } from "@modules/domain/automation-templates"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { AutomationGate, AutomationOffice, AutomationText, ExecutorContext } from "./automation-ports.contracts"
import type {
    BareReply,
    Composition,
    ConversationOrNone,
    LeadOrNone,
    NameOrNone,
} from "./automation-messages.contracts"
import type { MessageVariables, TextParams } from "./automations.contracts"
import { InjectAutomationGate, InjectAutomationOffice, InjectAutomationText } from "./automations.decorators"
import { AutomationsError, AutomationsErrorCode } from "./errors/automations.error"
import { SELECT_FIRST_STAFF, SELECT_LATEST_CONVERSATION, SELECT_LEAD } from "./persistence/automation-readers.sql"
import type { ConversationReadRow, LeadReadRow } from "./persistence/automations.rows"
import { acceptableMessage, fillBody, stripQuotes } from "./policies/config.policy"
import { CLASSIFY_SYSTEM, FEEDBACK_MAX, caseSystem, shopBlock } from "./policies/prompt.policy"
import { NEUTRAL_VARIABLES } from "./words.contracts"

@Injectable()
/**
 * How a customer message is written and leaves: the approved wording filled in (or adapted by the model within its guardrails),
 * then put through the authority gate, which decides whether it goes by itself or waits for the owner. Also the small loaders and
 * the words every executor shares.
 */
export class AutomationMessagesService {
    private negative: RegExp | undefined

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectAutomationGate() private readonly gate: AutomationGate,
        @InjectAutomationOffice() private readonly office: AutomationOffice,
        @InjectAutomationText() private readonly text: AutomationText,
    ) {}

    /** The Vietnamese text of a key; the runs the owner reads are stored in Vietnamese. */
    say(key: string, params: TextParams = {}): string {
        return this.catalog.get(`automations.${key}`, params, "vi")
    }

    /** Who the automation acts as in the evidence log and on work items. */
    actorOf(def: TemplateDefinition): string {
        return `${this.say("actor")} · ${def.name.vi}`
    }

    /** A run that did nothing, and why. */
    skipped(detail: string): RunResult {
        return { status: "skipped", steps: [{ label: this.say("step.skipped"), status: "skipped", detail }] }
    }

    /** A run that did nothing because the customer has no conversation to answer on. */
    noChannel(name: string): RunResult {
        return this.skipped(this.say("noChannel", { name }))
    }

    /** One lead of a workspace, or none. */
    async lead(workspaceId: string, leadId: string): Promise<LeadOrNone> {
        const [row] = await this.entityManager.query<Array<LeadReadRow>>(SELECT_LEAD, [workspaceId, leadId])
        return row ?? null
    }

    /** The lead of an id the trigger carried; none when it carried none. */
    leadOf(workspaceId: string, leadId: string): Promise<LeadOrNone> {
        return leadId ? this.lead(workspaceId, leadId) : Promise.resolve(null)
    }

    /** The latest real conversation of a lead: where a message to the customer leaves. */
    async conversationOf(workspaceId: string, leadId: string): Promise<ConversationOrNone> {
        const [row] = await this.entityManager.query<Array<ConversationReadRow>>(SELECT_LATEST_CONVERSATION, [
            workspaceId,
            leadId,
        ])
        return row ?? null
    }

    /** The name of the first active staff member, or none. */
    async firstStaffName(workspaceId: string): Promise<NameOrNone> {
        const [row] = await this.entityManager.query<Array<{ name: string }>>(SELECT_FIRST_STAFF, [workspaceId])
        return row?.name ?? null
    }

    /**
     * Writes one customer message (the approved wording filled in; for `ai_per_case` the model adapts it within the guardrails) and
     * puts it through the authority gate. The run result tells whether it left, waits for the owner or was refused.
     */
    async composeAndSend(context: ExecutorContext, composition: Composition): Promise<RunResult> {
        const written = await this.writeMessage(
            context,
            { ten_shop: context.shop.shop, gio_mo_cua: context.shop.hours, ...composition.vars },
            composition.caseNote,
        )
        const isReply = composition.action === "reply_customer"
        const outcome = await this.gate.submit({
            workspaceId: context.workspaceId,
            actor: this.actorOf(context.def),
            action: composition.action,
            subject: isReply
                ? { type: "conversation", id: composition.conversationId }
                : { type: "lead", id: composition.lead.id },
            leadId: composition.lead.id,
            dedupeKey: `automation:${context.pipeline.id}:${composition.dedupe}`,
            summary: composition.summary,
            draft: written.text,
            fields: {
                customer: composition.lead.contact_name,
                contact: composition.lead.phone || composition.lead.email || "website",
                ...(isReply ? { conversation_id: composition.conversationId, question: "" } : {}),
            },
            forceAsk: composition.forceAsk,
            autoApprove: context.pipeline.auto_send && !composition.forceAsk,
        })
        if (outcome.autoApproved) {
            await this.office.logEvidence(context.workspaceId, {
                leadId: composition.lead.id,
                kind: "automation.auto_send",
                actor: this.actorOf(context.def),
                summary: this.say("gate.autoSend", { name: context.def.name.vi }),
            })
        }
        const drafted: RunStep = {
            label: this.say(written.generated ? "step.drafted" : "step.filled"),
            status: "done",
            message: written.text,
        }
        const withItem = (label: string, status: RunStep["status"], detail?: string): RunStep => ({
            label,
            status,
            detail,
            workItemId: outcome.itemId,
            message: written.text,
        })
        if (outcome.state === "sent") {
            return {
                status: "done",
                steps: [drafted, withItem(this.say("step.sent"), "done", outcome.summary ?? undefined)],
                evidence: outcome.summary,
            }
        }
        if (outcome.state === "waiting") {
            return {
                status: "waiting_approval",
                steps: [
                    drafted,
                    withItem(
                        this.say("step.waiting"),
                        "waiting",
                        this.say("gate.reason", { reason: outcome.reason ?? this.say("gate.reasonFallback") }),
                    ),
                ],
                evidence: this.say("evidence.waiting"),
            }
        }
        if (outcome.state === "rejected") {
            return { status: "skipped", steps: [drafted, withItem(this.say("step.rejected"), "skipped")] }
        }
        throw new AutomationsError({
            code: AutomationsErrorCode.MessageNotSent,
            cause: new Error(outcome.error ?? this.say("error.notSent")),
        })
    }

    /** No lead yet: the reply is still a gated work item on the conversation. */
    async replyWithoutLead(context: ExecutorContext, reply: BareReply): Promise<RunResult> {
        const text = fillBody(
            context.body,
            { ten_shop: context.shop.shop, gio_mo_cua: context.shop.hours, ten_khach: reply.name },
            this.neutral(),
        )
        const outcome = await this.gate.submit({
            workspaceId: context.workspaceId,
            actor: this.actorOf(context.def),
            action: "reply_customer",
            subject: { type: "conversation", id: reply.conversationId },
            leadId: null,
            dedupeKey: `automation:${context.pipeline.id}:${reply.dedupe}`,
            summary: this.say("after.summary", { name: reply.name }),
            draft: text,
            fields: { conversation_id: reply.conversationId, question: "" },
            forceAsk: false,
            autoApprove: false,
        })
        const step: RunStep = { label: "", status: "done", workItemId: outcome.itemId, message: text }
        if (outcome.state === "sent") {
            return {
                status: "done",
                steps: [{ ...step, label: this.say("step.sent"), detail: outcome.summary ?? undefined }],
                evidence: outcome.summary,
            }
        }
        if (outcome.state === "waiting") {
            return {
                status: "waiting_approval",
                steps: [{ ...step, label: this.say("step.waiting"), status: "waiting" }],
                evidence: this.say("evidence.waiting"),
            }
        }
        throw new AutomationsError({
            code: AutomationsErrorCode.MessageNotSent,
            cause: new Error(outcome.error ?? this.say("error.notSent")),
        })
    }

    /** True when a customer's feedback is negative: a keyword check first, then (with a model) one classification; no on any doubt. */
    async isNegative(feedback: string, workspaceId: string): Promise<boolean> {
        const text = feedback.trim()
        if (!text) return false
        this.negative ??= new RegExp(this.say("pattern.negative"), "i")
        if (this.negative.test(text)) return true
        const raw = await this.text.generate({
            workspaceId,
            purpose: "classify",
            system: CLASSIFY_SYSTEM,
            prompt: text.slice(0, FEEDBACK_MAX),
        })
        return /NEGATIVE/i.test(raw ?? "")
    }

    private async writeMessage(
        context: ExecutorContext,
        variables: MessageVariables,
        caseNote: string,
    ): Promise<{ readonly text: string; readonly generated: boolean }> {
        const filled = fillBody(context.body, variables, this.neutral())
        if (context.def.contentMode !== "ai_per_case") return { text: filled, generated: false }
        const raw = await this.text.generate({
            workspaceId: context.workspaceId,
            purpose: "per_case",
            system: caseSystem(context.def),
            prompt: `${shopBlock(context.shop, "")}\n\nApproved message:\n${filled}\n\nCase: ${caseNote}`,
        })
        const text = raw === null ? "" : stripQuotes(raw)
        return acceptableMessage(text) ? { text, generated: true } : { text: filled, generated: false }
    }

    private neutral(): Readonly<Record<string, string>> {
        return Object.fromEntries(NEUTRAL_VARIABLES.map((name) => [name, this.say(`neutral.${name}`)]))
    }
}
