import type { AiRouterModuleOptions, KeyConfig, ModelConfig, ModelCost, ProviderConfig } from "@starci/ai-router"
import type { AiGatewayKey, AiGatewayOptions, AiGatewayProvider } from "./ai-gateway.options"
import { EMBEDDING_PROFILES } from "@nivo-lite/blocks-core"
import { servedProfilesOf } from "./ai-gateway-config.policy"
import { ANTHROPIC_PROVIDER, OPENAI_PROVIDER, modelProfilesOf } from "./ai-gateway-profiles.policy"
import type { ModelProfileSeats } from "./ai-gateway-profiles.policy"

/** The profile of chat work: the `model` an OpenAI client asks for. */
export const WORK_PROFILE = "work"


/**
 * How long one attempt of a chat call may take at the gateway, milliseconds. The caller sets the real deadline of each call by its
 * kind (a task, a graph node's call: at most two minutes); the gateway must never cut an attempt before the caller would, or a
 * call the caller still waits for fails as a gateway timeout. So it sits above the longest deadline a caller may set.
 */
export const WORK_ATTEMPT_TIMEOUT_MS = 125_000

/** The whole chat call at the gateway, waits and backoff included: one full attempt, with room to fail over after a quick failure. */
export const WORK_DEADLINE_MS = 130_000

/**
 * Claude Haiku 5.5 list price, USD per million tokens, prompts up to 100K tokens (the Claude API skill's table cached 2026-11-03;
 * NOT re-read from the live pricing page: not verified). The cache prices are NOT in that table: derived from Anthropic's usual
 * multipliers (read 0.1x input, five-minute write 1.25x, one-hour write 2x): not verified. The gateway's cost quotas and the cost it
 * reports in `usage.served.cost`; the app books from `usage-cost.policy.ts`.
 */
const CHEAP_COST: ModelCost = { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125, cacheWrite1h: 0.2 }
/**
 * Claude Sonnet 5.5 list price, USD per million tokens (Anthropic first-party; the skill's table of 2026-11-03, cache reads $0.10;
 * writes 2.5 / 4 as the router's own example prices them): not re-read live, not verified.
 */
const STRONG_COST: ModelCost = { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5, cacheWrite1h: 4 }

/**
 * What a Claude 5.5 model takes, applied by the router per attempt on both routes: no sampling field (Sonnet 5.5 and Haiku 5.5 refuse
 * a non-default one), a forced tool choice sent as `auto` plus an instruction (Sonnet 5.5 answers 400 to a forced one; Haiku 5.5 is
 * treated the same), and the prompt-cache breakpoints the request marks.
 */
const CLAUDE_REQUEST_SHAPE: Pick<ModelConfig, "omit" | "forcedToolUse" | "cacheControl"> = {
    omit: ["temperature", "top_p", "top_k"],
    forcedToolUse: false,
    cacheControl: true,
}

/**
 * The `max_tokens` the router sends Anthropic when a call sets none (Anthropic requires one; the router's default is 4096). Sonnet
 * thinks by default and its thinking counts against it, so 4096 would cut a node's answer; this leaves room for long reasoning.
 */
const STRONG_DEFAULT_MAX_TOKENS = 32_000

/** The attempts of a profile with a fallback: one per candidate, so a provider with no usable lane (no key, down) hands over once. */
const FALLBACK_ATTEMPTS = 2
/**
 * OpenAI `text-embedding-3-small`, USD per million tokens: the repo's own price line (`usage-cost.policy.ts`), not re-read from OpenAI's
 * page (not verified). The gateway's cost quotas only.
 */
const OPENAI_EMBED_COST = { input: 0.02, output: 0 }

/** The models of every pinned embeddings profile on OpenAI, each with its identity and vector length (a reply of another length fails). */
const openAiEmbedModels = (): Array<ModelConfig> => [
    ...new Map(
        Object.values(EMBEDDING_PROFILES).map((entry): [string, ModelConfig] => [
            entry.model,
            { id: entry.model, identity: entry.model, dimensions: entry.dimensions, capabilities: ["embeddings"], cost: OPENAI_EMBED_COST },
        ]),
    ).values(),
]

/** The pinned embeddings profiles: one model identity each, on OpenAI alone; a call can never land on another vector space. */
const embedProfiles = (): NonNullable<AiRouterModuleOptions["profiles"]> =>
    Object.fromEntries(
        Object.entries(EMBEDDING_PROFILES).map(([name, entry]) => [
            name,
            { pinned: true, candidates: [{ provider: OPENAI_PROVIDER, model: entry.model }], allowFallback: false },
        ]),
    )

/** The router reads each key from the secret parsed at boot, so a `<KEY>_FILE` mount works like a plain variable. */
const keyOf = (key: AiGatewayKey): KeyConfig => ({ alias: key.alias, resolve: () => key.secret.reveal() })

const providerOf = (provider: AiGatewayProvider, models: ReadonlyArray<ModelConfig>): ProviderConfig => ({
    id: provider.id,
    kind: provider.kind,
    baseUrl: provider.baseUrl,
    ...(provider.kind === "anthropic" ? { defaultMaxTokens: STRONG_DEFAULT_MAX_TOKENS } : {}),
    keys: provider.keys.map(keyOf),
    models,
})

/**
 * A model profile of a graph node's call: its candidates in order, one attempt per candidate, the same per-attempt timeout and
 * deadline as `work`. A profile of one candidate (an explicit model) never falls back: an explicit model never switches silently.
 */
const modelProfileOf = (profile: ModelProfileSeats): NonNullable<AiRouterModuleOptions["profiles"]>[string] => ({
    candidates: profile.candidates.map((candidate) => ({ provider: candidate.provider, model: candidate.model })),
    allowFallback: profile.candidates.length > 1,
    maxAttempts: profile.candidates.length > 1 ? FALLBACK_ATTEMPTS : 1,
    timeoutMs: WORK_ATTEMPT_TIMEOUT_MS,
    deadlineMs: WORK_DEADLINE_MS,
})

/** The pool over a non-empty provider list: Anthropic serves every chat profile, OpenAI the pinned embeddings profiles. */
const poolOf = (options: AiGatewayOptions): AiRouterModuleOptions => {
    const chatCapabilities: ModelConfig["capabilities"] = ["chat", "streaming", "tools", "json", "vision"]
    const cheap: ModelConfig = { id: options.models.work, capabilities: chatCapabilities, cost: CHEAP_COST, ...CLAUDE_REQUEST_SHAPE }
    const strong: ModelConfig = { id: options.models.strong, capabilities: chatCapabilities, cost: STRONG_COST, ...CLAUDE_REQUEST_SHAPE }
    const modelsOf = (provider: AiGatewayProvider): Array<ModelConfig> =>
        provider.id === ANTHROPIC_PROVIDER ? [cheap, strong] : openAiEmbedModels()
    const served = new Set(servedProfilesOf(options.providers, options.models))
    const modelProfiles = Object.fromEntries(
        modelProfilesOf(options.providers, options.models).map((profile) => [profile.name, modelProfileOf(profile)]),
    )
    return {
        providers: options.providers.map((provider) => providerOf(provider, modelsOf(provider))),
        profiles: {
            ...(served.has(WORK_PROFILE)
                ? {
                      [WORK_PROFILE]: {
                          // The cheap model, Sonnet when it has no usable lane: Claude only, never another vendor.
                          candidates: [
                              { provider: ANTHROPIC_PROVIDER, model: options.models.work },
                              { provider: ANTHROPIC_PROVIDER, model: options.models.strong },
                          ],
                          // One attempt per call: the caller (the AI task layer) owns the count of tries of a model call, so the
                          // gateway never multiplies it by retrying on its own.
                          maxAttempts: 1,
                          timeoutMs: WORK_ATTEMPT_TIMEOUT_MS,
                          deadlineMs: WORK_DEADLINE_MS,
                      },
                  }
                : {}),
            ...(options.providers.some((provider) => provider.id === OPENAI_PROVIDER) ? embedProfiles() : {}),
            // The profiles a graph node's call names (`MODEL_PROFILES`), present while Anthropic holds a key.
            ...modelProfiles,
        },
        telemetry: { includeContent: false },
    }
}

/**
 * The router pool built from the parsed options, or null when no provider holds a key: the router refuses an empty pool, so the app
 * then registers neither router nor gateway. A conditional expression, not an `if`, because the contract emitter reads the module
 * graph statically and accepts an option-dependent choice only as an expression whose branches serve the same resolvers.
 */
export const routerOptionsOf = (options: AiGatewayOptions): AiRouterModuleOptions | null =>
    options.providers.length === 0 ? null : poolOf(options)
