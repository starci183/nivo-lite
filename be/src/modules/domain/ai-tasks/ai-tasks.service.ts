import { Injectable } from "@nestjs/common"
import {
  InjectAi,
  type AiAgentTurns,
  type AiChatAnswer,
  type AiChatModel,
  type AiService,
} from "@modules/integrations/ai"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { InjectTimer, type Timer } from "@modules/platform/retry"
import type { Locale } from "@modules/platform/i18n"
import type {
    ConfiguredProviders,
    CallMeta,
    ChatMessage,
    AiTaskScope,
    MeterEntry,
    NodeAsk,
    TextRequest,
} from "./ai-tasks.contracts"
import { InjectAiTaskMeter, InjectAiTasksOptions } from "./ai-tasks.decorators"
import { AiTasksLogEvent } from "./ai-tasks.log-events"
import { type AiTasksOptions, type NodeReasoning } from "./ai-tasks.options"
import type { AiTaskMeter } from "./ai-tasks.port"
import type { TaskSchema } from "./ai-tasks.schema"
import { agentReasoningOf, agentToolChoiceOf, agentTurnMetaOf, type AgentTurnsAsk } from "./agent-turn.policy"
import { callLimitsOf } from "./call-limits.policy"
import { meteredCallOf } from "./metered-call.policy"
import { failedTryEntryOf, promptCharsOf } from "./failed-try.policy"
import { modelChoiceOf, modelFactsOf, servedModelOf, type ModelChoice } from "./model-choice.policy"
import { modelPickerOf, type ModelPicker } from "./model-picker.mapper"
import {
  NOT_JSON,
  failedTries,
  fallbackOf,
  newTries,
  pauseBeforeRetryMs,
  triesRemain,
  type Tries,
} from "./model-tries.policy"
import { AiTasksError, AiTasksErrorCode } from "./errors/ai-tasks.error"
import { NodeImagesService } from "./node-images.service"
import { withPicturesNotSeen } from "@modules/domain/chat-files"
import { NotesService } from "./notes.service"
import {
  embeddedObject,
  isJsonRecord,
  unfenced,
  type JsonRecord,
  type OptionalJsonRecord,
} from "./json.mapper"
import { nodeMessagesOf, nodeMetaOf } from "./node-prompt.policy"

/** What a call adds to a plain prompt: the shape of a JSON answer and the question the business notes are retrieved for. */
interface CallOptions {
    /** The structured-output schema of a JSON task, or null. */
    readonly schema: TaskSchema | null
    /** The question to retrieve business notes for, or null when the task needs none. */
    readonly question: string | null
    /** The reasoning a node named for its own call, when it named one. */
    readonly reasoning?: NodeAsk["reasoning"]
    /** The call kind booked with the usage: a graph node's `purpose`; absent for a fixed task. */
    readonly purpose?: string
}

/** A graph node's free-text call. */
const NODE_TEXT: CallOptions = { schema: null, question: null }

/** The providers of a deployment that declares none: Anthropic alone, the only chat provider of the pool. */
const CLAUDE_ONLY: ConfiguredProviders = { anthropic: true, openrouter: false }

/** An answer with the model choice of the try that gave it (null for a fixed task of the app). */
interface ChosenAnswer {
    readonly answer: AiChatAnswer
    readonly choice: ModelChoice | null
}

/** What the turns of one step's agent share: the model of the step's first answer, which every later turn keeps. */
interface AgentTurnsState {
    /** The explicit model the first answered turn was served by; null before it (or when it is not a model of the vocabulary). */
    pinned: ReturnType<typeof servedModelOf>
    /** The prompt tokens of the step's last answered turn: what a failed turn after it is booked with (null before any answer). */
    lastPromptTokens: number | null
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
 * The model door of NIVO's graph nodes. This client talks to no model provider itself: it runs a node's text, JSON and agent-loop
 * calls through the LangChain client, metered against the workspace allowance. There is no second door: without the AI endpoint (`AI_BASE_URL`, `STARCI_AI_KEY`) every call fails as unavailable.
 * Every call names its workspace and language explicitly.
 */
export class AiTasksService {
    constructor(
        @InjectAiTasksOptions() private readonly options: AiTasksOptions,
        @InjectAi() private readonly ai: AiService,
        @InjectAiTaskMeter() private readonly meter: AiTaskMeter,
        @InjectLogger() private readonly logger: Logger,
        @InjectTimer() private readonly timer: Timer,
        private readonly notes: NotesService,
        private readonly images: NodeImagesService,
    ) {}

    /** A graph node's free-text call: its instructions and input, metered as engine work of the node's namespace. */
    async nodeText(scope: AiTaskScope, ask: NodeAsk): Promise<string> {
        return this.complete(scope, nodeMessagesOf(await this.inlined(scope, ask)), false, nodeMetaOf(ask), {
            ...NODE_TEXT,
            reasoning: ask.reasoning,
            purpose: ask.purpose,
        })
    }

    /** A graph node's structured call: the answer the schema asks for, asked again as often as the options allow. */
    async nodeJson(scope: AiTaskScope, ask: NodeAsk, schema: TaskSchema): Promise<JsonRecord> {
        return this.completeJson(
            scope,
            nodeMessagesOf(await this.inlined(scope, ask), schema),
            nodeMetaOf(ask),
            schema,
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
        const reasoning = agentReasoningOf(this.options, ask, scope.model?.weight)
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
        const turns: AgentTurnsState = { pinned: null, lastPromptTokens: null }
        let built: Promise<AiChatModel | undefined> | undefined
        // Built when first read, once: the client a first try gets, for the loop to construct its agent over. Never asked. Async: the
        // router reads the gateway's catalog to know which protocol's client the name gets.
        const firstClient = (): Promise<AiChatModel | undefined> => {
            built ??= this.ai
                .turnModel({
                    ...callLimitsOf(this.options, asked, 1, scope.model?.maxOutputTokens),
                    affinity: request.workspaceId,
                    ...(first === null ? {} : { target: first.target }),
                })
                .then((model) => model ?? undefined)
            return built
        }
        // A forced tool call only where every model the step may use takes one (Anthropic's Sonnet 5.5 refuses it). A step with no
        // model of its own asks the endpoint's `work` profile, Claude only since 2026-11-11: never forced either.
        const forced = agentToolChoiceOf(reasoning) === "required" && first?.target.forcedToolChoice
        return {
            toolChoice: forced ? "required" : "auto",
            turn: (attempt) => this.agentTurn(scope, request, asked, attempt, turns),
            get model(): Promise<AiChatModel | undefined> {
                return firstClient()
            },
        }
    }

    /**
     * The node drawer's model picker in a language: Auto and the explicit models (each available only while its provider holds a key
     * in this deployment), the default model, and what blocks-core declares for every node step that calls AI.
     */
    modelPicker(locale: Locale): ModelPicker {
        return modelPickerOf(locale, this.options.providers ?? CLAUDE_ONLY)
    }

    /**
     * The pictures of a node's agent as the data addresses a model request carries, in order, the unreadable ones left out: the
     * same inlining, with the same limits, as a node's JSON call does for its own pictures. For a loop that builds its messages
     * itself (the agent loop): a provider outside the deployment cannot fetch the store's own addresses. No pictures, no read.
     */
    async nodeImages(scope: AiTaskScope, images: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        if (images.length === 0) return []
        return (await this.images.inline(images, scope.workspaceId)).images
    }

    /** The model of the first try of a step's agent, or null for no declared model or one that cannot be served (the turn says so). */
    private firstChoiceOf(scope: AiTaskScope): ModelChoice | null {
        if (scope.model === undefined) return null
        const chosen = modelChoiceOf(scope.model, 1, this.options.providers ?? CLAUDE_ONLY)
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
            ...callLimitsOf(this.options, reasoning, tries.made, scope.model?.maxOutputTokens),
            affinity: request.workspaceId,
            ...(choice === null ? {} : { target: choice.target }),
            ...fallbackOf(tries),
        }
        // The client comes from the router's catalog: a catalog that cannot be read, or a name it does not serve, is a failed try
        // of its own (`provider`), retried like any provider failure.
        const client = await this.ai.turnModel(limits).then(
            (model) => ({ model, cause: undefined }),
            (cause: unknown) => ({ model: undefined, cause }),
        )
        if (client.model === null) throw new AiTasksError({ code: AiTasksErrorCode.Unavailable })
        const elapsed = this.ai.stopwatch()
        const asked = client.model === undefined ? Promise.reject(client.cause) : attempt(client.model, tries.made)
        const tried = await asked.then(
            (message) => ({ message, read: this.ai.readTurn(message, limits, elapsed()) }),
            (cause: unknown) => ({
                message: undefined,
                read: { ok: false as const, failure: this.ai.failureOfThrow(cause), spent: undefined },
            }),
        )
        if (tried.read.ok && tried.message !== undefined) {
            turns.pinned ??= servedModelOf(tried.read.model)
            turns.lastPromptTokens = tried.read.usage.promptTokens ?? turns.lastPromptTokens
            await this.meter.record({
                workspaceId: request.workspaceId,
                kind: request.kind,
                module: request.module,
                usage: {
                    prompt_tokens: tried.read.usage.promptTokens ?? 0,
                    completion_tokens: tried.read.usage.completionTokens ?? 0,
                    cached_tokens: tried.read.usage.cachedTokens ?? 0,
                    cache_write_tokens: tried.read.usage.cacheWriteTokens ?? 0,
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
        const spent = tried.read.ok ? undefined : tried.read.spent
        tries.failures.push(failure)
        await this.bookFailed(
            failedTryEntryOf(request, failure, tries.made, choice, { tokens: turns.lastPromptTokens }, spent),
        )
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

    /**
     * The node's call with its pictures carried as bytes: a provider outside the deployment cannot fetch the store's own addresses. A
     * picture that could not be read is told to the model as a fact of its input (`picturesNotSeen`), so it never claims to have seen it.
     */
    private async inlined(scope: AiTaskScope, ask: NodeAsk): Promise<NodeAsk> {
        if (ask.images === undefined || ask.images.length === 0) return ask
        const shown = await this.images.inline(ask.images, scope.workspaceId)
        return { ...ask, images: shown.images, input: withPicturesNotSeen(ask.input, shown.dropped) }
    }

    /** Every text prompt goes through here. */
    private async complete(
        scope: AiTaskScope,
        messages: ReadonlyArray<ChatMessage>,
        json: boolean,
        meta: CallMeta,
        options: CallOptions,
    ): Promise<string> {
        return (await this.run(scope, messages, json, meta, options)).text
    }

    /**
     * One generation for the workspace of the scope on the AI endpoint; without the endpoint the call fails as unavailable. `tries`
     * is the count of the whole model call: a caller that asks again (a JSON answer that was no JSON) hands the same count on, so
     * every kind of AI failure draws on the one allowance.
     */
    private run(
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
                cache_write_tokens: answer.usage.cacheWriteTokens ?? 0,
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

    /** Books a failed try (estimated, never billed); nothing for a try that was never sent. The meter never throws. */
    private async bookFailed(entry: MeterEntry | null): Promise<void> {
        if (entry !== null) await this.meter.record(entry)
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
        const chosen = modelChoiceOf(scope.model, tryNumber, this.options.providers ?? CLAUDE_ONLY, pinned)
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
        const limits = callLimitsOf(this.options, options.reasoning, tries.made, scope.model?.maxOutputTokens)
        const tried = await this.ai.attempt({
            ...call,
            ...limits,
            ...(choice === null ? {} : { target: choice.target }),
            ...fallbackOf(tries),
        })
        if (tried.ok) return { answer: tried.answer, choice }
        tries.failures.push(tried.failure)
        await this.bookFailed(
            failedTryEntryOf(
                request,
                tried.failure,
                tries.made,
                choice,
                { chars: promptCharsOf(call.messages) },
                tried.spent,
            ),
        )
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
        tries: Tries,
        node: Pick<NodeAsk, "reasoning" | "purpose">,
    ): Promise<JsonRecord> {
        const options: CallOptions = { schema, question: null, reasoning: node.reasoning, purpose: node.purpose }
        const ran = await this.run(scope, messages, true, meta, options, tries)
        const parsed = ran.parsed ?? this.parseObject(ran.text)
        if (parsed !== null) return parsed
        tries.failures.push(NOT_JSON)
        if (!triesRemain(tries)) throw failedTries(AiTasksErrorCode.JsonNotReturned, tries)
        const again: ChatMessage = { role: "system", content: JSON_AGAIN }
        return this.completeJson(scope, [...messages, again], meta, schema, tries, node)
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
