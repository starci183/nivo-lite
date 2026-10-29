import { Injectable } from "@nestjs/common"
import { InjectAi } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import type {
    AgentInput,
    AuthorityChange,
    CallMeta,
    ChatMessage,
    ChatTurn,
    Classification,
    CommandProposalInput,
    AiTaskScope,
    DesignedModule,
    ExtractedOrder,
    LeadInput,
    OptionalAgentInput,
    ProposedCommand,
    ProposedResponsibility,
    TextRequest,
} from "./ai-tasks.contracts"
import { InjectAiTaskMeter, InjectAiTasksOptions, InjectAiTaskTextGenerator } from "./ai-tasks.decorators"
import { AiTasksLogEvent } from "./ai-tasks.log-events"
import type { AiTasksOptions } from "./ai-tasks.options"
import type { AiTaskMeter, AiTaskTextGenerator } from "./ai-tasks.port"
import {
    AUTHORITY_SCHEMA,
    CLASSIFICATION_SCHEMA,
    COMMAND_SCHEMA,
    DESIGN_SCHEMA,
    LEAD_TURN_SCHEMA,
    ORDER_SCHEMA,
    RESPONSIBILITY_SCHEMA,
} from "./ai-tasks.schema"
import type { TaskSchema } from "./ai-tasks.schema"
import { AiTasksError, AiTasksErrorCode } from "./errors/ai-tasks.error"
import { NotesService } from "./notes.service"
import { embeddedObject, isJsonRecord, unfenced } from "./json.mapper"
import type { JsonRecord, OptionalJsonRecord } from "./json.mapper"
import { leadTurnPrompt } from "./lead-turn-prompt.policy"
import type { LeadTurnInput } from "./lead-turn-prompt.policy"
import { commandProposalPrompt, langFor, NIVO, personaOf, toMessages } from "./prompts.policy"
import {
    authorityChangeOf,
    classificationOf,
    designedModuleOf,
    extractedOrderOf,
    proposedCommandOf,
    responsibilityOf,
} from "./results.mapper"

const OWNER_CHAT: CallMeta = { kind: "owner_chat", module: "office" }
const OFFICE_COMMAND: CallMeta = { kind: "office_command", module: "office" }
const SETUP: CallMeta = { kind: "setup", module: "setup" }
const SALES: CallMeta = { kind: "engine", module: "sales" }
const LEAD_TURN: CallMeta = { kind: "chat_reply", module: "lead_gen" }
const ACCOUNTING: CallMeta = { kind: "engine", module: "accounting" }
/** What a call adds to a plain prompt: the shape of a JSON answer and the question the business notes are retrieved for. */
interface CallOptions {
    /** The structured-output schema of a JSON task, or null. */
    readonly schema: TaskSchema | null
    /** The question to retrieve business notes for, or null when the task needs none. */
    readonly question: string | null
}

/** A call with neither a schema nor retrieval. */
const PLAIN: CallOptions = { schema: null, question: null }

/** The result of one run: the text, and the structured output when the model produced one. */
interface Ran {
    /** The answer text. */
    readonly text: string
    /** The structured output, or null. */
    readonly parsed: OptionalJsonRecord
}

const JSON_AGAIN = "Answer again with ONLY the JSON object described above. No prose, no code fences."

@Injectable()
/**
 * The prompt library of NIVO. This client talks to no model provider itself: it builds the prompts of the app (summaries, lead
 * classification, drafts, the authority chat) and runs each one through the LangChain client once a key is set (metered against
 * the workspace allowance), and through the OpenClaw text generator port while it is not. Every call names its workspace and
 * language explicitly.
 */
export class AiTasksService {
    constructor(
        @InjectAiTasksOptions() private readonly options: AiTasksOptions,
        @InjectAiTaskTextGenerator() private readonly generator: AiTaskTextGenerator,
        @InjectAi() private readonly ai: AiService,
        @InjectAiTaskMeter() private readonly meter: AiTaskMeter,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly notes: NotesService,
    ) {}

    /** A customer context brief: 3-5 short bullet points. */
    summarizeContext(scope: AiTaskScope, lead: LeadInput, history: ReadonlyArray<string>): Promise<string> {
        return this.complete(
            scope,
            [
                {
                    role: "system",
                    content: `${NIVO} Write a customer context brief: 3-5 short bullet points starting with "- " (who, need, urgency, risks, what we know). ${this.phrase("urgencyLabels", scope.locale)} No preamble.${langFor(scope.locale)}`,
                },
                {
                    role: "user",
                    content: `Lead: ${JSON.stringify(lead)}\nHistory:\n${history.join("\n") || "(none)"}`,
                },
            ],
            false,
            SALES,
        )
    }

    /** One responsibility for a lead: an agent owns routine follow-up, the human owns judgement and commitments. */
    async proposeResponsibility(
        scope: AiTaskScope,
        lead: LeadInput,
        context: string,
        agents: ReadonlyArray<AgentInput>,
        humanName: string,
    ): Promise<ProposedResponsibility> {
        const answer = await this.completeJson(
            scope,
            [
                {
                    role: "system",
                    content: `${NIVO} Propose ONE responsibility for this lead. Choose the owner: an agent (by handle) when the work is routine follow-up, the human "${humanName}" when judgement or a commitment is needed. Reply as JSON {"title","owner_kind":"human"|"agent","owner_handle":string|null,"next_action","due_in_days":number,"rationale"}. The title, next_action and rationale values:${langFor(scope.locale)}`,
                },
                {
                    role: "user",
                    content: `Lead: ${JSON.stringify(lead)}\nContext:\n${context}\nAgents: ${JSON.stringify(agents.map(({ name, handle, role }) => ({ name, handle, role })))}`,
                },
            ],
            SALES,
            RESPONSIBILITY_SCHEMA,
        )
        return responsibilityOf(answer)
    }

    /** The outbound message that performs the next action of a lead. */
    draftFollowUp(
        scope: AiTaskScope,
        lead: LeadInput,
        context: string,
        nextAction: string,
        agent: OptionalAgentInput,
        brief: string,
    ): Promise<string> {
        const who = agent === null ? "" : `You are ${agent.name} (${agent.role}). Instructions: ${agent.instructions}`
        return this.complete(
            scope,
            [
                {
                    role: "system",
                    content: `${NIVO} ${who}${brief} Draft the outbound message that performs the next action. Match the lead's channel. Write in Vietnamese unless the lead's need is in English. Max 120 words. Output only the message.`,
                },
                {
                    role: "user",
                    content: `Lead: ${JSON.stringify(lead)}\nContext:\n${context}\nNext action: ${nextAction}`,
                },
            ],
            false,
            SALES,
            { schema: null, question: `${nextAction} ${lead.need}` },
        )
    }

    /** An agent's reply in the team group chat. */
    agentReply(
        scope: AiTaskScope,
        agent: AgentInput,
        transcript: ReadonlyArray<string>,
        workspaceBrief: string,
        brief: string,
    ): Promise<string> {
        return this.complete(
            scope,
            [
                {
                    role: "system",
                    content: `${NIVO} You are ${agent.name} (@${agent.handle}), role: ${agent.role}. Instructions: ${agent.instructions}${brief}\nWorkspace state:\n${workspaceBrief}\nReply in the team group chat, in the language of the last message, max 90 words. If an action is outside the granted authority, say it needs the owner's decision.`,
                },
                { role: "user", content: transcript.join("\n") },
            ],
            false,
            OWNER_CHAT,
        )
    }

    /** The owner testing an agent in its setup screen: it behaves exactly as it would with a customer. */
    testChat(scope: AiTaskScope, agent: AgentInput, turns: ReadonlyArray<ChatTurn>, brief: string): Promise<string> {
        return this.complete(
            scope,
            [
                {
                    role: "system",
                    content: `${NIVO} ${personaOf(agent, brief)}\nThe business owner is testing you. Behave exactly as you would with a customer. Max 80 words.`,
                },
                ...toMessages(turns),
            ],
            false,
            OWNER_CHAT,
        )
    }

    /** An agent definition designed from the owner's description. */
    async designModule(scope: AiTaskScope, description: string): Promise<DesignedModule> {
        const answer = await this.completeJson(
            scope,
            [
                {
                    role: "system",
                    content: `${NIVO} Turn the owner's description into an AI agent definition. JSON {"name","handle" (lowercase, a-z0-9-, max 16),"role" (max 6 words),"instructions" (4-6 imperative sentences, include what needs human approval)}. The name, role and instructions values:${langFor(scope.locale)}`,
                },
                { role: "user", content: description },
            ],
            SETUP,
            DESIGN_SCHEMA,
        )
        return designedModuleOf(answer)
    }

    /** Sales AI: classifies a lead with a confidence score, the next step, what is missing and a short context brief (one call). */
    async classifyLead(
        scope: AiTaskScope,
        lead: LeadInput,
        history: ReadonlyArray<string>,
        brief: string,
    ): Promise<Classification> {
        const answer = await this.completeJson(
            scope,
            [
                {
                    role: "system",
                    content: `${NIVO}${brief}
You are the Sales AI. Classify this lead. JSON {"stage":"new"|"qualified"|"proposal"|"won"|"lost","confidence":number 0..1,"next_action":string (one concrete step, max 14 words),"missing":string[] (information still missing, short),"context":string (3-4 short bullet points starting with "- ": who, need, urgency, risk)}.
Use "qualified" when the need is clear and fits; "new" when too little is known yet.
"confidence" is how sure you are that the STAGE you chose is right - not how likely the deal is. A real enquiry with a stated need is "new" or "qualified" with confidence 0.7 or higher, even if details are missing (list those in "missing").
Use a confidence below 0.6 only when you cannot tell what the message is (spam, unrelated, contradictory, no identifiable need). The next_action, missing and context values:${langFor(scope.locale)}`,
                },
                {
                    role: "user",
                    content: `Lead: ${JSON.stringify(lead)}\nHistory:\n${history.join("\n") || "(none)"}`,
                },
            ],
            SALES,
            CLASSIFICATION_SCHEMA,
        )
        return classificationOf(answer)
    }

    /** Reads an order from free text when the channel gave no structured amount; a price is never guessed. */
    async extractOrder(scope: AiTaskScope, text: string): Promise<ExtractedOrder> {
        const answer = await this.completeJson(
            scope,
            [
                {
                    role: "system",
                    content: `${NIVO} Extract the order from the customer's message. JSON {"items": string (what they order, short), "amount_vnd": integer VND or null when no total is stated (never guess a price), "confidence": number 0..1}. ${this.phrase("orderMoney", scope.locale)} The items value:${langFor(scope.locale)}`,
                },
                { role: "user", content: text },
            ],
            ACCOUNTING,
            ORDER_SCHEMA,
        )
        return extractedOrderOf(answer)
    }

    /** Sales AI: a short thank-you and care message after the customer paid. */
    draftCare(scope: AiTaskScope, lead: LeadInput, paymentNote: string, brief: string): Promise<string> {
        return this.complete(
            scope,
            [
                {
                    role: "system",
                    content: `${NIVO}${brief} You are the Sales AI. Write a short, warm customer-care message after the customer's payment was received: thank them, confirm what was paid (item, amount, record code), and end with the next step: ${this.phrase("careExample", scope.locale)} by replying with a convenient day and time. No new commitments or prices. ${this.phrase("careAddress", scope.locale)} - never guess gender. Write as the business itself (never mention NIVO or AI). Plain text for a chat app: no markdown, no asterisks. Max 70 words. Output only the message.${langFor(scope.locale)}`,
                },
                { role: "user", content: `Customer: ${JSON.stringify(lead)}\nPayment: ${paymentNote}` },
            ],
            false,
            SALES,
            { schema: null, question: lead.need },
        )
    }

    /** Reads the owner's plain-language grant of authority from a chat message into structured changes. */
    async parseAuthorityChat(scope: AiTaskScope, text: string, currentRules: string): Promise<AuthorityChange> {
        const answer = await this.completeJson(
            scope,
            [
                {
                    role: "system",
                    content: `${NIVO} The business owner tells NIVO in chat what authority to grant. Extract ONLY what the owner said. JSON {
"goals": {"revenue_vnd": integer|null, "new_customers": integer|null, "first_reply_minutes": integer|null, "note": string|null} ${this.phrase("authorityMoney", scope.locale)},
"policies_add": string[] (new business rules stated, short sentences, in the owner's language),
"reply_style": string|null, "brand_voice": string|null,
"limits_note_add": string|null (plain "always ask me when ..." statements, in the owner's language),
"rules": [{"action": one of reply_customer|handoff_lead|classify_lead|send_follow_up|send_quote|confirm_order|send_care|issue_invoice|reconcile_payment, "mode": "auto"|"ask"|"never"|null (null = unchanged), "limit_vnd": integer|null (auto strictly BELOW this amount; the amount itself and above ask; null = unchanged)}],
"understood": boolean (false when the message grants or changes nothing)}.
${this.phrase("authorityHints", scope.locale)}
Current rules: ${currentRules}`,
                },
                { role: "user", content: text },
            ],
            OWNER_CHAT,
            AUTHORITY_SCHEMA,
        )
        return authorityChangeOf(answer)
    }

    /** Reads the owner's Office message into at most one command of one agent: the model only picks, the caller validates what it returned. */
    async proposeCommands(scope: AiTaskScope, input: CommandProposalInput): Promise<ProposedCommand> {
        const answer = await this.completeJson(scope, commandProposalPrompt(input), OFFICE_COMMAND, COMMAND_SCHEMA)
        return proposedCommandOf(answer)
    }

    /** Lead generation: the one metered reading of a prospect's turn, as a JSON object the lead flow validates. */
    readLeadTurn(scope: AiTaskScope, input: LeadTurnInput): Promise<JsonRecord> {
        return this.completeJson(
            scope,
            leadTurnPrompt(input, this.phrase("leadVoice", scope.locale)),
            LEAD_TURN,
            LEAD_TURN_SCHEMA,
        )
    }

    private phrase(key: string, locale: Locale): string {
        return this.catalog.get(`prompts.${key}`, {}, locale)
    }

    /** Every text prompt goes through here. */
    private async complete(
        scope: AiTaskScope,
        messages: ReadonlyArray<ChatMessage>,
        json: boolean,
        meta: CallMeta,
        options: CallOptions = PLAIN,
    ): Promise<string> {
        return (await this.run(scope, messages, json, meta, options)).text
    }

    /** One generation for the workspace of the scope, on the AI endpoint when a key is set, through the OpenClaw door when not. */
    private async run(
        scope: AiTaskScope,
        messages: ReadonlyArray<ChatMessage>,
        json: boolean,
        meta: CallMeta,
        options: CallOptions,
    ): Promise<Ran> {
        const request: TextRequest = {
            workspaceId: scope.workspaceId,
            purpose: `${meta.module}:${meta.kind}`,
            messages,
            json,
            kind: scope.kind ?? meta.kind,
            module: scope.module ?? meta.module,
        }
        if (!this.ai.available()) return { text: await this.generator.generate(request), parsed: null }
        return this.metered(scope, request, options)
    }

    /** One prompt on the AI endpoint: refused when the workspace is over its allowance, metered once it answered. */
    private async metered(scope: AiTaskScope, request: TextRequest, options: CallOptions): Promise<Ran> {
        const notice = await this.meter.blockedBy(request.workspaceId, request.kind, scope.locale)
        if (notice !== null) {
            throw new AiTasksError({ code: AiTasksErrorCode.QuotaBlocked, params: { message: notice.message } })
        }
        const answer = await this.ai.chat({
            messages: request.messages,
            json: request.json,
            schema: request.json ? options.schema : null,
            timeoutMs: this.options.timeoutMs,
            context: this.notes.contextOf(scope, options.question),
        })
        if (answer === null) throw new AiTasksError({ code: AiTasksErrorCode.Unavailable })
        await this.meter.record({
            workspaceId: request.workspaceId,
            kind: request.kind,
            module: request.module,
            usage: {
                prompt_tokens: answer.usage.promptTokens ?? 0,
                completion_tokens: answer.usage.completionTokens ?? 0,
                cached_tokens: 0,
                cost: answer.usage.costUsd ?? 0,
                model: answer.model,
            },
            completionChars: answer.text.length,
        })
        return { text: answer.text, parsed: answer.parsed }
    }

    /** A JSON completion: the structured output when the model gave one, else a loose parse; it asks again as often as the options allow. */
    private async completeJson(
        scope: AiTaskScope,
        messages: ReadonlyArray<ChatMessage>,
        meta: CallMeta,
        schema: TaskSchema,
        retriesLeft = this.options.jsonRetries,
    ): Promise<JsonRecord> {
        const ran = await this.run(scope, messages, true, meta, { schema, question: null })
        const parsed = ran.parsed ?? this.parseObject(ran.text)
        if (parsed !== null) return parsed
        if (retriesLeft <= 0) throw new AiTasksError({ code: AiTasksErrorCode.JsonNotReturned })
        const again: ChatMessage = { role: "system", content: JSON_AGAIN }
        return this.completeJson(scope, [...messages, again], meta, schema, retriesLeft - 1)
    }

    /** The JSON object of an answer: bare, fenced, or the first {...} block inside prose. */
    private parseObject(raw: string): OptionalJsonRecord {
        const text = unfenced(raw)
        const whole = this.parse(text)
        if (whole !== null) return whole
        const inner = embeddedObject(text)
        return inner === null ? null : this.parse(inner)
    }

    private parse(text: string): OptionalJsonRecord {
        try {
            const value: unknown = JSON.parse(text)
            return isJsonRecord(value) ? value : null
        } catch {
            this.logger.warn(AiTasksLogEvent.NotJson, { length: text.length })
            return null
        }
    }
}
