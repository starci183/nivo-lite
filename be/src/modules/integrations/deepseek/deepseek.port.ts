import type { Locale } from "@modules/platform/i18n"
import type {
    MeterEntry,
    OptionalQuotaNotice,
    PooledAnswerResult,
    PooledRequest,
    TextRequest,
} from "./deepseek.contracts"

/** The OpenClaw door to the text AI: the app root binds it to the generations capability. It is used while the pool holds no key. */
export interface DeepseekTextGenerator {
    /** Runs a prompt and answers the text; fails with a typed error when the model cannot answer. */
    generate(request: TextRequest): Promise<string>
}

/** The AI pool the prompts run through once it holds a chat key; the app root binds it to the pool client. */
export interface DeepseekPool {
    /** True when a chat call can reach a provider. */
    chatReady(): boolean
    /** One chat completion; null when no lane answered. */
    chat(request: PooledRequest): Promise<PooledAnswerResult>
}

/** The plan allowance and the usage meter a pooled prompt runs through; the app root binds it to the usage gate. */
export interface DeepseekMeter {
    /** The notice when the workspace has used its allowance for the kind. */
    blockedBy(workspaceId: string, kind: string, locale: Locale): Promise<OptionalQuotaNotice>
    /** Meters one finished generation. */
    record(entry: MeterEntry): Promise<void>
}
