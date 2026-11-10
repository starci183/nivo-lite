import type { ChatMessage, MeterEntry, TextRequest } from "./ai-tasks.contracts"
import { meteredCallOf } from "./metered-call.policy"
import { modelFactsOf } from "./model-choice.policy"
import type { ModelChoice } from "./model-choice.policy"

/** The model a failed try of a fixed task is booked with: the endpoint's chat profile served it, its model was never told. */
const UNTOLD_MODEL = "work"

/** What the app knows of a failed try's prompt: its characters (a call it built), or the tokens of the step's last answer (an agent turn). */
export type FailedPrompt = { readonly chars: number } | { readonly tokens: number | null }

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
): MeterEntry | null => {
    if (failure === "unconfigured") return null
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
