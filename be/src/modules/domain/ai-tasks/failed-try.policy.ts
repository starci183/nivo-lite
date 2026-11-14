import type { AiCutSpend } from "@modules/integrations/ai"
import type { ChatMessage, MeterEntry, TextRequest } from "./ai-tasks.contracts"
import { meteredCallOf } from "./metered-call.policy"
import { modelFactsOf, type ModelChoice } from "./model-choice.policy"

/** The model a failed try of a fixed task is booked with: the endpoint's chat profile served it, its model was never told. */
const UNTOLD_MODEL = "work"

/** What the app knows of a failed try's prompt: its characters (a call it built), or the tokens of the step's last answer (an agent turn). */
export type FailedPrompt = { readonly chars: number } | { readonly tokens: number | null }

/** The characters the meter estimates as one token (its own rule: about 3 per token); a cap in tokens is booked as this many characters. */
const CHARS_PER_TOKEN = 3

/** The characters of a prompt: every message's text (pictures are not counted). */
export const promptCharsOf = (messages: ReadonlyArray<Pick<ChatMessage, "content">>): number =>
    messages.reduce((total, message) => total + message.content.length, 0)

/**
 * The meter entry of a FAILED try (a timeout, a provider error, an answer cut at the token limit or empty): the provider may charge
 * for it, so it is booked (owner, 2026-11-11), estimated, with what the app knows of the prompt and no output, priced at the model the
 * try asked for, and flagged with its failure so it is never billed. A try the deployment could not even send (`unconfigured`) is
 * not a try: it is not booked.
 */
export const failedTryEntryOf = (
    request: Pick<TextRequest, "workspaceId" | "kind" | "module" | "purpose">,
    failure: string,
    tryNumber: number,
    choice: ModelChoice | null,
    prompt: FailedPrompt,
    spent?: AiCutSpend,
): MeterEntry | null => {
    if (failure === "unconfigured") return null
    if (spent !== undefined) return cutTryEntryOf(request, failure, tryNumber, choice, prompt, spent)
    const model = choice?.intended ?? UNTOLD_MODEL
    const tokens = "tokens" in prompt ? prompt.tokens : null
    return {
        workspaceId: request.workspaceId,
        kind: request.kind,
        module: request.module,
        usage:
            tokens === null ? null : { prompt_tokens: tokens, completion_tokens: 0, cached_tokens: 0, cost: 0, model },
        ...(tokens === null ? { model } : {}),
        completionChars: 0,
        promptChars: "chars" in prompt ? prompt.chars : 0,
        failure,
        call: meteredCallOf(
            request.purpose,
            { promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null },
            tryNumber,
            undefined,
            choice === null ? null : modelFactsOf(choice, model),
        ),
    }
}

/**
 * The meter entry of a try CUT at the token limit (FX5): the provider produced the output up to the cap and bills it. When the cut
 * reply carried its usage with the output tokens, the try is booked with the provider's own figures (`reported`: not estimated) and
 * the time, upstream and finish of the try; otherwise its output is estimated as the cap (the prompt as for any failed try) and the
 * row stays estimated. Never billed either way (it keeps its failure).
 */
const cutTryEntryOf = (
    request: Pick<TextRequest, "workspaceId" | "kind" | "module" | "purpose">,
    failure: string,
    tryNumber: number,
    choice: ModelChoice | null,
    prompt: FailedPrompt,
    spent: AiCutSpend,
): MeterEntry => {
    const known = "tokens" in prompt ? prompt.tokens : null
    const output = spent.usage.completionTokens
    const facts = choice === null ? null : modelFactsOf(choice, spent.model)
    const head = { workspaceId: request.workspaceId, kind: request.kind, module: request.module, failure }
    if (output !== null) {
        return {
            ...head,
            reported: true,
            usage: {
                prompt_tokens: spent.usage.promptTokens ?? known ?? 0,
                completion_tokens: output,
                cached_tokens: spent.usage.cachedTokens ?? 0,
                cache_write_tokens: spent.usage.cacheWriteTokens ?? 0,
                cost: spent.usage.costUsd ?? 0,
                model: spent.model,
            },
            completionChars: 0,
            call: meteredCallOf(request.purpose, spent.usage, tryNumber, spent.served, facts),
        }
    }
    const cap = spent.cap ?? 0
    const promptTokens = spent.usage.promptTokens ?? known
    const noUsage = { promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null }
    return {
        ...head,
        // The output the provider did not report is estimated as the cap it was allowed to write.
        usage:
            promptTokens === null
                ? null
                : {
                      prompt_tokens: promptTokens,
                      completion_tokens: cap,
                      cached_tokens: 0,
                      cost: 0,
                      model: spent.model,
                  },
        ...(promptTokens === null ? { model: spent.model } : {}),
        completionChars: promptTokens === null ? cap * CHARS_PER_TOKEN : 0,
        promptChars: "chars" in prompt ? prompt.chars : 0,
        call: meteredCallOf(request.purpose, noUsage, tryNumber, spent.served, facts),
    }
}
