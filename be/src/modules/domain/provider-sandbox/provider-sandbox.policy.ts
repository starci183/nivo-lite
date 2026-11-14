import { z } from "zod"
import {
    SANDBOX_FAILURE_KINDS,
    type SandboxCallOutcome,
    type SandboxFailure,
    type SandboxFixtureInput,
    type SandboxScriptInput,
    type SandboxScriptOutcome,
} from "./provider-sandbox.contracts"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "./errors/provider-sandbox.error"
import type { SandboxEntryInput } from "./provider-sandbox-store.port"

/** The longest operation word or key the store keeps. */
export const SANDBOX_WORD_MAX = 200

const failureSchema: z.ZodType<SandboxFailure> = z.object({
    kind: z.enum(SANDBOX_FAILURE_KINDS),
    reason: z.string().min(1).max(SANDBOX_WORD_MAX).optional(),
    detail: z.string().max(2000).optional(),
})

/** The stored shape of a script. */
export const scriptOutcomeSchema: z.ZodType<SandboxScriptOutcome> = z.union([
    z.object({ outcome: z.literal("answer"), value: z.unknown() }),
    z.object({ outcome: z.literal("fail"), failure: failureSchema }),
]) as z.ZodType<SandboxScriptOutcome>

/** The stored shape of a call's result. */
export const callOutcomeSchema: z.ZodType<SandboxCallOutcome> = z.union([
    z.object({ outcome: z.literal("answered"), by: z.enum(["script", "fixture", "default"]), value: z.unknown() }),
    z.object({ outcome: z.literal("failed"), failure: failureSchema }),
    z.object({ outcome: z.literal("threw"), error: z.string() }),
]) as z.ZodType<SandboxCallOutcome>

/** The stored body of a logged call. */
export const callBodySchema: z.ZodType<{ readonly request: unknown; readonly result: SandboxCallOutcome }> = z.object({
    request: z.unknown(),
    result: callOutcomeSchema,
}) as z.ZodType<{ readonly request: unknown; readonly result: SandboxCallOutcome }>

const invalid = (why: string): ProviderSandboxError =>
    new ProviderSandboxError({ code: ProviderSandboxErrorCode.EntryInvalid, params: { why } })

/** An operation word or key, trimmed; an empty operation or a word too long is refused. */
const wordOf = (word: string, empty: "allowed" | "refused"): string => {
    const trimmed = word.trim()
    if ((empty === "refused" && trimmed.length === 0) || trimmed.length > SANDBOX_WORD_MAX) throw invalid("word")
    return trimmed
}

/** The entry of a fixture. */
export const fixtureEntryOf = (input: SandboxFixtureInput): SandboxEntryInput => ({
    kind: "fixture",
    operation: wordOf(input.operation, "refused"),
    key: wordOf(input.key ?? "", "allowed"),
    body: { value: input.value === undefined ? null : input.value },
    remaining: null,
})

/** The entry of a script: a failure must name a known kind (a `refused` one its reason word); a count is a positive whole number. */
export const scriptEntryOf = (input: SandboxScriptInput): SandboxEntryInput => {
    const parsed = scriptOutcomeSchema.safeParse(input.script)
    if (!parsed.success) throw invalid("script")
    if (parsed.data.outcome === "fail" && parsed.data.failure.kind === "refused" && parsed.data.failure.reason === undefined)
        throw invalid("reason")
    if (input.times !== undefined && (!Number.isInteger(input.times) || input.times < 1)) throw invalid("times")
    return {
        kind: "script",
        operation: wordOf(input.operation, "refused"),
        key: wordOf(input.key ?? "", "allowed"),
        body: parsed.data,
        remaining: input.times ?? null,
    }
}

/** The word a thrown error is logged under: its `code` when it has one (a DomainError), else its name. */
export const thrownWordOf = (cause: unknown): string => {
    if (cause instanceof Error) {
        const code: unknown = Reflect.get(cause, "code")
        return typeof code === "string" ? code : cause.name
    }
    return "unknown"
}
