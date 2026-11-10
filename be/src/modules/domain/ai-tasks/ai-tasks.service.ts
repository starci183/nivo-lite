import { Injectable } from "@nestjs/common"
import { InjectAi } from "@modules/integrations/ai"
import type { AiAgentTurns, AiChatAnswer, AiChatModel, AiService } from "@modules/integrations/ai"
import { InjectLogger } from "@modules/platform/logging"
import { InjectTimer } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import type { Logger } from "@modules/platform/logging"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import type {
    AgentInput,
    ConfiguredProviders,
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
    NodeAsk,
    OptionalAgentInput,
    ProposedCommand,
    ProposedResponsibility,
    TextRequest,
} from "./ai-tasks.contracts"
import { InjectAiTaskMeter, InjectAiTasksOptions } from "./ai-tasks.decorators"
import { AiTasksLogEvent } from "./ai-tasks.log-events"
import type { AiTasksOptions } from "./ai-tasks.options"
import type { AiTaskMeter } from "./ai-tasks.port"
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
import { agentReasoningOf, agentToolChoiceOf, agentTurnMetaOf } from "./agent-turn.policy"
import type { AgentTurnsAsk } from "./agent-turn.policy"
import type { NodeReasoning } from "./ai-tasks.options"
import { callLimitsOf } from "./call-limits.policy"
import { meteredCallOf } from "./metered-call.policy"
import { modelChoiceOf, modelFactsOf, servedModelOf } from "./model-choice.policy"
import { modelPickerOf } from "./model-picker.mapper"
import type { ModelPicker } from "./model-picker.mapper"
import type { ModelChoice } from "./model-choice.policy"
import type { CallKind } from "./call-limits.policy"
import { NOT_JSON, failedTries, newTries, pauseBeforeRetryMs, triesRemain } from "./model-tries.policy"
import type { Tries } from "./model-tries.policy"
import { AiTasksError, AiTasksErrorCode } from "./errors/ai-tasks.error"
import { NodeImagesService } from "./node-images.service"
import { NotesService } from "./notes.service"
import { embeddedObject, isJsonRecord, unfenced } from "./json.mapper"
import { nodeMessagesOf, nodeMetaOf } from "./node-prompt.policy"
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
    /** The kind of call, which sets its deadline and what a reasoning model may spend on it. */
    readonly call: CallKind
    /** The reasoning a node named for its own call, when it named one. */
    readonly reasoning?: NodeAsk["reasoning"]
    /** The call kind booked with the usage: a graph node's `purpose`; absent for a fixed task. */
    readonly purpose?: string
}

/** A task with neither a schema nor retrieval. */
const PLAIN: CallOptions = { schema: null, question: null, call: "task" }

/** A graph node's free-text call. */
const NODE_TEXT: CallOptions = { schema: null, question: null, call: "node" }

/** The providers of a deployment that declares none: the upstream alone, as before Anthropic joined the pool. */
const UPSTREAM_ONLY: ConfiguredProviders = { anthropic: false, openrouter: true }

/** An answer with the model choice of the try that gave it (null for a fixed task of the app). */
interface ChosenAnswer {
    readonly answer: AiChatAnswer
    readonly choice: ModelChoice | null
}

/** What the turns of one step's agent share: the model of the step's first answer, which every later turn keeps. */
interface AgentTurnsState {
    /** The explicit model the first answered turn was served by; null before it (or when it is not a model of the vocabulary). */
    pinned: ReturnType<typeof servedModelOf>
}

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
 * classification, drafts, the authority chat) and runs each one through the LangChain client, metered against the workspace
 * allowance. There is no second door: without the AI endpoint (`AI_BASE_URL`, `STARCI_AI_KEY`) every call fails as unavailable.
 * Every call names its workspace and language explicitly.
 */
export class AiTasksService {
    constructor(
        @InjectAiTasksOptions() private readonly options: AiTasksOptions,
        @InjectAi() private readonly ai: AiService,
        @InjectAiTaskMeter() private readonly meter: AiTaskMeter,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        @InjectTimer() private readonly timer: Timer,
        private readonly notes: NotesService,
        private readonly images: NodeImagesService,
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
            { schema: null, question: `${nextAction} ${lead.need}`, call: "task" },
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
            { schema: null, question: lead.need, call: "task" },
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

    /** A graph node's free-text call: its instructions and input, metered as engine work of the node's namespace. */
    async nodeText(scope: AiTaskScope, ask: NodeAsk): Promise<string> {
        return this.complete(scope, nodeMessagesOf(await this.inlined(ask)), false, nodeMetaOf(ask), {
            ...NODE_TEXT,
            reasoning: ask.reasoning,
            purpose: ask.purpose,
        })
    }

    /** A graph node's structured call: the answer the schema asks for, asked again as often as the options allow. */
    async nodeJson(scope: AiTaskScope, ask: NodeAsk, schema: TaskSchema): Promise<JsonRecord> {
        return this.completeJson(
            scope,
            nodeMessagesOf(await this.inlined(ask), schema),
            nodeMetaOf(ask),
            schema,
            "node",
            newTries(),
            ask,
        )
    }

    /**
     * The model side of ONE run of a node's agent loop (the loop on LangChain's prebuilt agent). The loop asks for one agent turn
     * at a time; each turn runs under the same policy as every model call of a node: three tries in all, the first with the node
     * call's deadline and each retry with the shorter one, a pause before retrying a provider error, a turn cut at the token limit
     * or empty counted as the AI's failure, the workspace's allowance checked before the first call and each answered try metered
     * as engine work of the node's namespace. When the last try fails too the turn throws unavailable, with the tries and the
     * failure of each: the loop lets it out, and the step stops as "the AI failed".
     */
    nodeAgentTurns(scope: AiTaskScope, ask: AgentTurnsAsk): AiAgentTurns {
        const reasoning = agentReasoningOf(this.options, ask)
        const meta = agentTurnMetaOf(ask)
        const request: TextRequest = {
            workspaceId: scope.workspaceId,
            messages: [],
            json: false,
            kind: scope.kind ?? meta.kind,
            module: scope.module ?? meta.module,
            purpose: ask.purpose,
        }
        const asked = reasoning === "default" ? undefined : reasoning
        // The step's model on its first try; a choice that cannot be served fails the step at its first turn, not here.
        const first = this.firstChoiceOf(scope)
        // Every turn of ONE step stays on the model of its first answer (a prompt cache is per model).
        const turns: AgentTurnsState = { pinned: null }
        let built: AiChatModel | null | undefined
        // Built when first read, once: the client a first try gets, for the loop to construct its agent over. Never asked.
        const firstClient = (): AiChatModel | undefined => {
            built ??= this.ai.turnModel({
                ...callLimitsOf(this.options, "node", asked, 1),
                affinity: request.workspaceId,
                ...(first === null ? {} : { target: first.target }),
            })
            return built ?? undefined
        }
        // A forced tool call only where every model the step may use takes one (Anthropic's Sonnet 5.5 refuses it).
        const forced = agentToolChoiceOf(reasoning) === "required" && (first === null || first.target.forcedToolChoice)
        return {
            toolChoice: forced ? "required" : "auto",
            turn: (attempt) => this.agentTurn(scope, request, asked, attempt, turns),
            get model(): AiChatModel | undefined {
                return firstClient()
            },
        }
    }

    /**
     * The node drawer's model picker in a language: Auto and the explicit models (each available only while its provider holds a key
     * in this deployment), the default model, and what blocks-core declares for every node step that calls AI.
     */
    modelPicker(locale: Locale): ModelPicker {
        return modelPickerOf(locale, this.options.providers ?? UPSTREAM_ONLY)
    }

    /**
     * The pictures of a node's agent as the data addresses a model request carries, in order, the unreadable ones left out: the
     * same inlining, with the same limits, as a node's JSON call does for its own pictures. For a loop that builds its messages
     * itself (the agent loop): a provider outside the deployment cannot fetch the store's own addresses. No pictures, no read.
     */
    async nodeImages(_scope: AiTaskScope, images: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        if (images.length === 0) return []
        return (await this.images.inline(images)).images
    }

    /** The model of the first try of a step's agent, or null for no declared model or one that cannot be served (the turn says so). */
    private firstChoiceOf(scope: AiTaskScope): ModelChoice | null {
        if (scope.model === undefined) return null
        const chosen = modelChoiceOf(scope.model, 1, this.options.providers ?? UPSTREAM_ONLY)
        return chosen.ok ? chosen.choice : null
    }

    /** One agent turn: the allowance, then the tries. */
    private async agentTurn<M>(
        scope: AiTaskScope,
        request: TextRequest,
        reasoning: Exclude<NodeReasoning, "default"> | undefined,
        attempt: (model: AiChatModel, tryNumber: number) => Promise<M>,
        turns: AgentTurnsState,
    ): Promise<M> {
        if (!this.ai.available()) throw new AiTasksError({ code: AiTasksErrorCode.Unavailable })
        const notice = await this.meter.blockedBy(request.workspaceId, request.kind, scope.locale)
        if (notice !== null) {
            throw new AiTasksError({ code: AiTasksErrorCode.QuotaBlocked, params: { message: notice.message } })
        }
        return this.triedTurn(scope, request, reasoning, attempt, newTries(), turns)
    }

    /** The message of the first try of the turn that is an answer, metered; or the unavailable error once no try is left. */
    private async triedTurn<M>(
        scope: AiTaskScope,
        request: TextRequest,
        reasoning: Exclude<NodeReasoning, "default"> | undefined,
        attempt: (model: AiChatModel, tryNumber: number) => Promise<M>,
        tries: Tries,
        turns: AgentTurnsState,
    ): Promise<M> {
        if (!triesRemain(tries)) throw failedTries(AiTasksErrorCode.Unavailable, tries)
        tries.made += 1
        // Before the step's first answer the model is chosen per try (Auto may step up); after it, every turn keeps that model.
        const choice = this.choiceOf(scope, tries.made, turns.pinned)
        const limits = {
            ...callLimitsOf(this.options, "node", reasoning, tries.made),
            affinity: request.workspaceId,
            ...(choice === null ? {} : { target: choice.target }),
        }
        const model = this.ai.turnModel(limits)
        if (model === null) throw new AiTasksError({ code: AiTasksErrorCode.Unavailable })
        const elapsed = this.ai.stopwatch()
        const tried = await attempt(model, tries.made).then(
            (message) => ({ message, read: this.ai.readTurn(message, limits, elapsed()) }),
            (cause: unknown) => ({ message: undefined, read: { ok: false as const, failure: this.ai.failureOfThrow(cause) } }),
        )
        if (tried.read.ok && tried.message !== undefined) {
            turns.pinned ??= servedModelOf(tried.read.model)
            await this.meter.record({
                workspaceId: request.workspaceId,
                kind: request.kind,
                module: request.module,
                usage: {
                    prompt_tokens: tried.read.usage.promptTokens ?? 0,
                    completion_tokens: tried.read.usage.completionTokens ?? 0,
                    cached_tokens: tried.read.usage.cachedTokens ?? 0,
                    cost: tried.read.usage.costUsd ?? 0,
                    model: tried.read.model,
                },
                completionChars: tried.read.textChars,
                call: meteredCallOf(
                    request.purpose,
                    tried.read.usage,
                    tries.made,
                    tried.read.served,
                    choice === null ? null : modelFactsOf(choice, tried.read.model),
                ),
            })
            return tried.message
        }
        const failure = tried.read.ok ? "empty" : tried.read.failure
        tries.failures.push(failure)
        this.logger.warn(AiTasksLogEvent.Retried, {
            workspaceId: request.workspaceId,
            module: request.module,
            tried: tries.made,
            failure,
            again: triesRemain(tries),
        })
        if (triesRemain(tries)) await this.paused(pauseBeforeRetryMs(failure))
        return this.triedTurn(scope, request, reasoning, attempt, tries, turns)
    }

    /** The node's call with its pictures carried as bytes: a provider outside the deployment cannot fetch the store's own addresses. */
    private async inlined(ask: NodeAsk): Promise<NodeAsk> {
        if (ask.images === undefined || ask.images.length === 0) return ask
        return { ...ask, images: (await this.images.inline(ask.images)).images }
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

    /**
     * One generation for the workspace of the scope on the AI endpoint; without the endpoint the call fails as unavailable. `tries`
     * is the count of the whole model call: a caller that asks again (a JSON answer that was no JSON) hands the same count on, so
     * every kind of AI failure draws on the one allowance.
     */
    private async run(
        scope: AiTaskScope,
        messages: ReadonlyArray<ChatMessage>,
        json: boolean,
        meta: CallMeta,
        options: CallOptions,
        tries: Tries = newTries(),
    ): Promise<Ran> {
        if (!this.ai.available()) throw new AiTasksError({ code: AiTasksErrorCode.Unavailable })
        const request: TextRequest = {
            workspaceId: scope.workspaceId,
            messages,
            json,
            kind: scope.kind ?? meta.kind,
            module: scope.module ?? meta.module,
            ...(options.purpose === undefined ? {} : { purpose: options.purpose }),
        }
        return this.metered(scope, request, options, tries)
    }

    /**
     * One prompt on the AI endpoint: refused when the workspace is over its allowance, tried again while the AI itself failed (the
     * deadline, a cut or empty answer, the provider) and tries remain, metered once it answered. The model had not answered, so a
     * try that failed did nothing and is not metered: asking again repeats no effect. THIS is the one place that counts the tries
     * of a model call (`MODEL_TRIES` in all): the gateway makes one attempt per try and no caller loops over it. When the last try
     * fails too the call is unavailable, with the tries made and the failure of each, for whoever reports "the AI failed".
     */
    private async metered(scope: AiTaskScope, request: TextRequest, options: CallOptions, tries: Tries): Promise<Ran> {
        const notice = await this.meter.blockedBy(request.workspaceId, request.kind, scope.locale)
        if (notice !== null) {
            throw new AiTasksError({ code: AiTasksErrorCode.QuotaBlocked, params: { message: notice.message } })
        }
        const call = {
            messages: request.messages,
            json: request.json,
            schema: request.json ? options.schema : null,
            context: this.notes.contextOf(scope, options.question),
            affinity: request.workspaceId,
        }
        const { answer, choice } = await this.answered(scope, request, call, options, tries)
        // Read after the answer: `answered` counted the try that gave it.
        const answeredOnTry = tries.made
        await this.meter.record({
            workspaceId: request.workspaceId,
            kind: request.kind,
            module: request.module,
            usage: {
                prompt_tokens: answer.usage.promptTokens ?? 0,
                completion_tokens: answer.usage.completionTokens ?? 0,
                cached_tokens: answer.usage.cachedTokens ?? 0,
                cost: answer.usage.costUsd ?? 0,
                model: answer.model,
            },
            completionChars: answer.text.length,
            call: meteredCallOf(
                request.purpose,
                answer.usage,
                answeredOnTry,
                answer.served,
                choice === null ? null : modelFactsOf(choice, answer.model),
            ),
        })
        return { text: answer.text, parsed: answer.parsed }
    }

    /** Waits before the next try; no wait at all for a pause of nothing. */
    private paused(ms: number): Promise<void> {
        if (ms <= 0) return Promise.resolve()
        return new Promise((resolve) => {
            this.timer.schedule(() => resolve(), ms)
        })
    }

    /**
     * The model of one try of a graph node's call (`model-choice.policy.ts`), or null for a fixed task of the app (the endpoint's chat
     * profile, as before). An explicit model whose provider holds no key fails the call loudly before any try: it never switches.
     */
    private choiceOf(
        scope: AiTaskScope,
        tryNumber: number,
        pinned: ReturnType<typeof servedModelOf> = null,
    ): ModelChoice | null {
        if (scope.model === undefined) return null
        const chosen = modelChoiceOf(scope.model, tryNumber, this.options.providers ?? UPSTREAM_ONLY, pinned)
        if (chosen.ok) return chosen.choice
        this.logger.warn(AiTasksLogEvent.ModelNotConfigured, { workspaceId: scope.workspaceId, model: chosen.model })
        throw new AiTasksError({
            code: AiTasksErrorCode.Unavailable,
            params: { tries: 0, failures: `model_not_configured:${chosen.model}` },
        })
    }

    /** The answer of the call within the tries left, or the unavailable error that names every try's failure. */
    private async answered(
        scope: AiTaskScope,
        request: TextRequest,
        call: Omit<Parameters<AiService["attempt"]>[0], "timeoutMs" | "budget">,
        options: CallOptions,
        tries: Tries,
    ): Promise<ChosenAnswer> {
        if (!triesRemain(tries)) throw failedTries(AiTasksErrorCode.Unavailable, tries)
        tries.made += 1
        // The model of a node's call is chosen per try: Auto may step a light step up after a failed try.
        const choice = this.choiceOf(scope, tries.made)
        // The deadline of a try depends on which try it is: a node call's retries are given less time than its first try.
        const limits = callLimitsOf(this.options, options.call, options.reasoning, tries.made)
        const tried = await this.ai.attempt({ ...call, ...limits, ...(choice === null ? {} : { target: choice.target }) })
        if (tried.ok) return { answer: tried.answer, choice }
        tries.failures.push(tried.failure)
        this.logger.warn(AiTasksLogEvent.Retried, {
            workspaceId: request.workspaceId,
            module: request.module,
            tried: tries.made,
            failure: tried.failure,
            again: triesRemain(tries),
        })
        if (triesRemain(tries)) await this.paused(pauseBeforeRetryMs(tried.failure))
        return this.answered(scope, request, call, options, tries)
    }

    /**
     * A JSON completion: the structured output when the model gave one, else a loose parse. An answer that is no JSON object is an
     * AI failure like any other and draws on the same tries: the model is asked again while tries remain, never on a count of its own.
     */
    private async completeJson(
        scope: AiTaskScope,
        messages: ReadonlyArray<ChatMessage>,
        meta: CallMeta,
        schema: TaskSchema,
        call: CallKind = "task",
        tries: Tries = newTries(),
        node?: Pick<NodeAsk, "reasoning" | "purpose">,
    ): Promise<JsonRecord> {
        const options: CallOptions = {
            schema,
            question: null,
            call,
            reasoning: node?.reasoning,
            ...(node === undefined ? {} : { purpose: node.purpose }),
        }
        const ran = await this.run(scope, messages, true, meta, options, tries)
        const parsed = ran.parsed ?? this.parseObject(ran.text)
        if (parsed !== null) return parsed
        tries.failures.push(NOT_JSON)
        if (!triesRemain(tries)) throw failedTries(AiTasksErrorCode.JsonNotReturned, tries)
        const again: ChatMessage = { role: "system", content: JSON_AGAIN }
        return this.completeJson(scope, [...messages, again], meta, schema, call, tries, node)
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
