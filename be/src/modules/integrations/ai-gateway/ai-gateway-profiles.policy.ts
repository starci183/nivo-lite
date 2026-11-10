import type { AiGatewayModels, AiGatewayProvider } from "./ai-gateway.options"

/** The provider id of Anthropic, reached directly through the router's Messages adapter: every chat profile of the app. */
export const ANTHROPIC_PROVIDER = "anthropic"

/** The provider id of OpenAI directly (`OPENAI_API_KEY`): the pinned embeddings profile `embed-oa`. */
export const OPENAI_PROVIDER = "openai"

/**
 * The profiles a graph node's call names, one per choice of the node's model picker (blocks-core `models`). NIVO names a profile;
 * which provider, key and fallback serve it is the router's. `work` and `embed` stay the profiles of every fixed task of the app.
 */
export const MODEL_PROFILES = {
    /** Claude Sonnet 5.5 and nothing else: an explicit choice never switches model. */
    sonnet: "sonnet",
    /** The cheap model (blocks-core `CHEAP_MODEL`, Claude Haiku 5.5) and nothing else. */
    haiku: "haiku",
    /** Auto on a light step (and a retired model's call): the cheap model first, Sonnet when it has no usable lane. Claude only. */
    autoLight: "auto-light",
    /** Auto on a heavy step (and Auto's step up after a failed try): Sonnet first, the cheap model when Sonnet has no usable lane. */
    autoHeavy: "auto-heavy",
} as const

/** One profile name of `MODEL_PROFILES`. */
export type ModelProfile = (typeof MODEL_PROFILES)[keyof typeof MODEL_PROFILES]

/** One candidate of a model profile: which provider, and which of the pool's models on it. */
interface ProfileSeat {
    readonly provider: typeof ANTHROPIC_PROVIDER
    readonly model: keyof Pick<AiGatewayModels, "work" | "strong">
}

// Both seats are Anthropic (owner: no OpenRouter for chat): a profile never falls back to another vendor.
const CHEAP: ProfileSeat = { provider: ANTHROPIC_PROVIDER, model: "work" }
const STRONG: ProfileSeat = { provider: ANTHROPIC_PROVIDER, model: "strong" }

/** The candidates of each profile, in order; the router tries the next only when the one before has no usable lane. */
const SEATS: Readonly<Record<ModelProfile, ReadonlyArray<ProfileSeat>>> = {
    [MODEL_PROFILES.sonnet]: [STRONG],
    [MODEL_PROFILES.haiku]: [CHEAP],
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
 * a profile left with none left out. Every chat seat is Anthropic, so without `ANTHROPIC_API_KEY` no model profile is served and a
 * node's call fails loudly (`model_not_configured`); nothing switches vendor.
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
    /** True when OpenRouter's own fields are worth sending: never now (no OpenRouter in the pool); the field stays for the wire's shape. */
    readonly upstreamFields: boolean
}

/** The wire of a profile; a profile that reaches Anthropic gets the body every candidate accepts. */
export const profileWireOf = (profile: ModelProfile): ProfileWire => {
    const anthropic = SEATS[profile].some((seat) => seat.provider === ANTHROPIC_PROVIDER)
    return { sampling: !anthropic, forcedToolChoice: !anthropic, upstreamFields: false }
}
