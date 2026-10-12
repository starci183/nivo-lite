import { Injectable } from "@nestjs/common"
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
    DeepseekScope,
    DesignedModule,
    ExtractedOrder,
    LeadInput,
    OptionalAgentInput,
    ProposedCommand,
    ProposedResponsibility,
} from "./deepseek.contracts"
import { InjectDeepseekOptions, InjectDeepseekTextGenerator } from "./deepseek.decorators"
import { DeepseekLogEvent } from "./deepseek.log-events"
import type { DeepseekOptions } from "./deepseek.options"
import type { TextGenerator } from "./deepseek.port"
import { DeepseekError, DeepseekErrorCode } from "./errors/deepseek.error"
import { embeddedObject, isJsonRecord, unfenced } from "./json.mapper"
import type { JsonRecord, OptionalJsonRecord } from "./json.mapper"
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
const ACCOUNTING: CallMeta = { kind: "engine", module: "accounting" }
const JSON_AGAIN = "Answer again with ONLY the JSON object described above. No prose, no code fences."

@Injectable()
/**
 * The prompt library of NIVO. OpenClaw is the only text-generating AI: this client talks to no model provider, it builds the prompts of
 * the app (summaries, lead classification, drafts, the authority chat) and runs each one through the text generator port, which the app
 * root binds to an `openclaw.generate` job. Every call names its workspace and language explicitly.
 */
export class DeepseekClient {
    constructor(
        @InjectDeepseekOptions() private readonly options: DeepseekOptions,
        @InjectDeepseekTextGenerator() private readonly generator: TextGenerator,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** A customer context brief: 3-5 short bullet points. */
    summarizeContext(scope: DeepseekScope, lead: LeadInput, history: ReadonlyArray<string>): Promise<string> {
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
        scope: DeepseekScope,
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
        )
        return responsibilityOf(answer)
    }

    /** The outbound message that performs the next action of a lead. */
    draftFollowUp(
        scope: DeepseekScope,
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
        )
    }

    /** An agent's reply in the team group chat. */
    agentReply(
        scope: DeepseekScope,
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
    testChat(scope: DeepseekScope, agent: AgentInput, turns: ReadonlyArray<ChatTurn>, brief: string): Promise<string> {
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
    async designModule(scope: DeepseekScope, description: string): Promise<DesignedModule> {
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
        )
        return designedModuleOf(answer)
    }

    /** Sales AI: classifies a lead with a confidence score, the next step, what is missing and a short context brief (one call). */
    async classifyLead(
        scope: DeepseekScope,
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
        )
        return classificationOf(answer)
    }

    /** Reads an order from free text when the channel gave no structured amount; a price is never guessed. */
    async extractOrder(scope: DeepseekScope, text: string): Promise<ExtractedOrder> {
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
        )
        return extractedOrderOf(answer)
    }

    /** Sales AI: a short thank-you and care message after the customer paid. */
    draftCare(scope: DeepseekScope, lead: LeadInput, paymentNote: string, brief: string): Promise<string> {
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
        )
    }

    /** Reads the owner's plain-language grant of authority from a chat message into structured changes. */
    async parseAuthorityChat(scope: DeepseekScope, text: string, currentRules: string): Promise<AuthorityChange> {
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
        )
        return authorityChangeOf(answer)
    }

    /** Reads the owner's Office message into at most one command of one agent: the model only picks, the caller validates what it returned. */
    async proposeCommands(scope: DeepseekScope, input: CommandProposalInput): Promise<ProposedCommand> {
        const answer = await this.completeJson(scope, commandProposalPrompt(input), OFFICE_COMMAND)
        return proposedCommandOf(answer)
    }

    private phrase(key: string, locale: Locale): string {
        return this.catalog.get(`prompts.${key}`, {}, locale)
    }

    /** Every prompt goes through here: one generation for the workspace of the scope. */
    private complete(
        scope: DeepseekScope,
        messages: ReadonlyArray<ChatMessage>,
        json: boolean,
        meta: CallMeta,
    ): Promise<string> {
        const kind = scope.kind ?? meta.kind
        const module = scope.module ?? meta.module
        return this.generator.generate({
            workspaceId: scope.workspaceId,
            purpose: `${meta.module}:${meta.kind}`,
            messages,
            json,
            kind,
            module,
        })
    }

    /** A JSON completion: some providers answer in prose, so it parses loosely and asks again as often as the options allow. */
    private async completeJson(
        scope: DeepseekScope,
        messages: ReadonlyArray<ChatMessage>,
        meta: CallMeta,
        retriesLeft = this.options.jsonRetries,
    ): Promise<JsonRecord> {
        const parsed = this.parseObject(await this.complete(scope, messages, true, meta))
        if (parsed !== null) return parsed
        if (retriesLeft <= 0) throw new DeepseekError({ code: DeepseekErrorCode.JsonNotReturned })
        const again: ChatMessage = { role: "system", content: JSON_AGAIN }
        return this.completeJson(scope, [...messages, again], meta, retriesLeft - 1)
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
            this.logger.warn(DeepseekLogEvent.NotJson, { length: text.length })
            return null
        }
    }
}
