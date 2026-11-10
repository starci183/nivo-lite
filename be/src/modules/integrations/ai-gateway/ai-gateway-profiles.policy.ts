import type { AiGatewayModels, AiGatewayProvider } from "./ai-gateway.options"

/** The provider id of the OpenAI-compatible upstream (OpenRouter by default) that serves the cheap model and embeddings. */
export const UPSTREAM_PROVIDER = "upstream"

/** The provider id of Anthropic, reached directly through the router's Messages adapter. */
export const ANTHROPIC_PROVIDER = "anthropic"

/**
 * The profiles a graph node's call names, one per choice of the node's model picker (blocks-core `models`). NIVO names a profile;
 * which provider, key and fallback serve it is the router's. `work` and `embed` stay the profiles of every fixed task of the app.
 */
export const MODEL_PROFILES = {
    /** Claude Sonnet 5.5 and nothing else: an explicit choice never switches model. */
    sonnet: "sonnet",
    /** The cheap model (`LLM_MODEL`, DeepSeek flash by default) and nothing else. */
    deepseek: "deepseek",
    /** Auto on a light step: the cheap model first, Sonnet when the cheap one has no usable lane (no key, down). */
    autoLight: "auto-light",
    /** Auto on a heavy step (and Auto's step up after a failed try): Sonnet first, the cheap model when Sonnet has no usable lane. */
    autoHeavy: "auto-heavy",
} as const

/** One profile name of `MODEL_PROFILES`. */
export type ModelProfile = (typeof MODEL_PROFILES)[keyof typeof MODEL_PROFILES]

/** One candidate of a model profile: which provider, and which of the pool's models on it. */
interface ProfileSeat {
    readonly provider: typeof UPSTREAM_PROVIDER | typeof ANTHROPIC_PROVIDER
    readonly model: keyof Pick<AiGatewayModels, "work" | "strong">
}

const CHEAP: ProfileSeat = { provider: UPSTREAM_PROVIDER, model: "work" }
const STRONG: ProfileSeat = { provider: ANTHROPIC_PROVIDER, model: "strong" }

/** The candidates of each profile, in order; the router tries the next only when the one before has no usable lane. */
const SEATS: Readonly<Record<ModelProfile, ReadonlyArray<ProfileSeat>>> = {
    [MODEL_PROFILES.sonnet]: [STRONG],
    [MODEL_PROFILES.deepseek]: [CHEAP],
    [MODEL_PROFILES.autoLight]: [CHEAP, STRONG],
    [MODEL_PROFILES.autoHeavy]: [STRONG, CHEAP],
}

/** A model profile as the pool declares it: its name and its candidates (provider id, model id), the absent providers cut out. */
export interface ModelProfileSeats {
    /** The profile name. */
    readonly name: ModelProfile
    /** The candidates, in order; never empty. */
    readonly candidates: ReadonlyArray<{ readonly provider: string; readonly model: string }>
}

/**
 * The model profiles the pool serves with the providers that hold a key: each cut down to its candidates whose provider is present,
 * a profile left with none left out (Sonnet without an Anthropic key). Auto keeps working with one provider: it is then that one.
 */
export const modelProfilesOf = (
    providers: ReadonlyArray<Pick<AiGatewayProvider, "id">>,
    models: Pick<AiGatewayModels, "work" | "strong">,
): ReadonlyArray<ModelProfileSeats> => {
    const present = new Set(providers.map((provider) => provider.id))
    return Object.values(MODEL_PROFILES).flatMap((name) => {
        const candidates = SEATS[name]
            .filter((seat) => present.has(seat.provider))
            .map((seat) => ({ provider: seat.provider, model: models[seat.model] }))
        return candidates.length === 0 ? [] : [{ name, candidates }]
    })
}

/**
 * What the body of a call to a profile may carry, by the providers the profile can reach. The Anthropic Messages API refuses a
 * sampling setting other than its default (`temperature: 0` is a 400 on Sonnet 5.5) and a forced tool choice (`required` becomes
 * `any`, a 400); OpenRouter's own fields (`reasoning`, `session_id`, `provider`) mean nothing there (the router's adapter drops them).
 */
export interface ProfileWire {
    /** True when the body may set `temperature`: no candidate refuses it. */
    readonly sampling: boolean
    /** True when the body may force a tool call (`tool_choice: required`). */
    readonly forcedToolChoice: boolean
    /** True when OpenRouter's own fields are worth sending: some candidate is the OpenAI-compatible upstream. */
    readonly upstreamFields: boolean
}

/** The wire of a profile; a profile that reaches Anthropic gets the body every candidate accepts. */
export const profileWireOf = (profile: ModelProfile): ProfileWire => {
    const reaches = new Set(SEATS[profile].map((seat) => seat.provider))
    const anthropic = reaches.has(ANTHROPIC_PROVIDER)
    return { sampling: !anthropic, forcedToolChoice: !anthropic, upstreamFields: reaches.has(UPSTREAM_PROVIDER) }
}
