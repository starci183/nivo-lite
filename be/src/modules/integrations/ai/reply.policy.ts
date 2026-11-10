import { usageOf as routedUsageOf } from "@starci/ai-router/langchain"
import type { RoutedUsage } from "@starci/ai-router/langchain"
import { isRecord } from "@modules/platform/primitives"
import type { ContextPassage, AiMessage, AiUsage } from "./ai.contracts"

/** The most characters of one retrieved passage that go into the prompt. */
const PASSAGE_MAX_CHARS = 600

/** The heading of the retrieved block: it says what the notes are good for, and that they never give a price or an amount. */
export const NOTES_HEADING =
    "Business notes (from the owner's knowledge; use them for facts about the business). They never give a price or an amount: those come only from the invoice or the contract."

/** One field of a value that may be an object; undefined for anything else. */
export const fieldOf = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined)

const numberOf = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null

/** The first number of the candidates; null when none is one. */
const firstNumber = (...candidates: ReadonlyArray<unknown>): number | null =>
    candidates.map(numberOf).find((candidate) => candidate !== null) ?? null

/** The prompt tokens a call wrote to the provider's cache, as a field only when the endpoint said. */
const cacheWriteOf = (usageMetadata: unknown, raw: unknown, routed: RoutedUsage): Pick<AiUsage, "cacheWriteTokens"> => {
    const said = firstNumber(
        fieldOf(fieldOf(usageMetadata, "input_token_details"), "cache_creation"),
        fieldOf(raw, "cache_creation_input_tokens"),
        fieldOf(raw, "cache_write_tokens"),
        fieldOf(fieldOf(raw, "prompt_tokens_details"), "cache_write_tokens"),
    )
    return said === null ? {} : { cacheWriteTokens: Math.max(said, routed.cacheWriteTokens) }
}

/** The usage of a reply as `@starci/ai-router/langchain` reads it, for both protocols (OpenAI and Anthropic). */
const routedOf = (usageMetadata: unknown, responseMetadata: unknown): RoutedUsage =>
    routedUsageOf({ usage_metadata: usageMetadata, response_metadata: responseMetadata })

/**
 * What a call used. The router's `usageOf(reply)` (`@starci/ai-router/langchain` 0.7.0) reads it in one shape for both protocols:
 * the full-price input, the cache reads, the cache writes, the output, the hidden reasoning, and the cost the router priced. Here
 * `promptTokens` is the whole prompt (full-price input + cache reads + cache writes), `cachedTokens` the reads, `cacheWriteTokens`
 * the writes (a field only when the endpoint said). A field the reply does not carry falls back to LangChain's `tokenUsage`, to the
 * raw usage's `cost`, `prompt_cache_hit_tokens` (DeepSeek's own name) and `completion_tokens_details.reasoning_tokens`, else null.
 */
export const usageOf = (usageMetadata: unknown, responseMetadata: unknown): AiUsage => {
    const tokenUsage = fieldOf(responseMetadata, "tokenUsage")
    const raw = fieldOf(responseMetadata, "usage")
    const routed = routedOf(usageMetadata, responseMetadata)
    const reasoning = firstNumber(
        fieldOf(fieldOf(usageMetadata, "output_token_details"), "reasoning"),
        fieldOf(fieldOf(raw, "completion_tokens_details"), "reasoning_tokens"),
        fieldOf(fieldOf(raw, "output_tokens_details"), "thinking_tokens"),
    )
    return {
        promptTokens: firstNumber(fieldOf(usageMetadata, "input_tokens"), fieldOf(tokenUsage, "promptTokens")),
        completionTokens: firstNumber(fieldOf(usageMetadata, "output_tokens"), fieldOf(tokenUsage, "completionTokens")),
        totalTokens: firstNumber(fieldOf(usageMetadata, "total_tokens"), fieldOf(tokenUsage, "totalTokens")),
        costUsd: routed.cost ?? numberOf(fieldOf(raw, "cost")),
        reasoningTokens: reasoning === null ? null : Math.max(reasoning, routed.reasoningTokens),
        cachedTokens: firstNumber(
            fieldOf(fieldOf(usageMetadata, "input_token_details"), "cache_read"),
            fieldOf(fieldOf(raw, "prompt_tokens_details"), "cached_tokens"),
            fieldOf(raw, "prompt_cache_hit_tokens"),
        ),
        ...cacheWriteOf(usageMetadata, raw, routed),
    }
}

/**
 * The lane that served a reply, as the gateway wrote it into the usage (`usage.served`, `@starci/ai-router` 0.7.0): the pool model
 * and the pool provider; each null when the reply does not say.
 */
export const laneOf = (responseMetadata: unknown): { readonly model: string | null; readonly provider: string | null } => {
    const routed = routedOf(undefined, responseMetadata)
    return { model: routed.model ?? null, provider: routed.provider ?? null }
}

/** Why a reply ended, in either protocol's word (`finish_reason` of OpenAI, `stop_reason` of Anthropic); null when it does not say. */
export const finishOf = (responseMetadata: unknown): string | null => {
    const finish = fieldOf(responseMetadata, "finish_reason") ?? fieldOf(responseMetadata, "stop_reason")
    return typeof finish === "string" && finish !== "" ? finish : null
}

/** True when a reply was cut at the token limit (`length` on OpenAI, `max_tokens` on Anthropic): half a text is no answer. */
export const cutOf = (responseMetadata: unknown): boolean => {
    const finish = finishOf(responseMetadata)
    return finish === "length" || finish === "max_tokens"
}

/** The text of a message content: a string, or the text blocks of a content list joined. */
export const textOf = (content: unknown): string => {
    if (typeof content === "string") return content.trim()
    if (!Array.isArray(content)) return ""
    return content
        .map((block: unknown) => fieldOf(block, "text"))
        .filter((text): text is string => typeof text === "string")
        .join("")
        .trim()
}

/**
 * The model that answered: the pool model the gateway says served it (`usage.served.model`), else the response metadata's own name
 * (`model_name` on OpenAI, `model` on Anthropic); the asked model when nothing says.
 */
export const modelOf = (responseMetadata: unknown, asked: string): string => {
    const named = laneOf(responseMetadata).model ?? fieldOf(responseMetadata, "model_name") ?? fieldOf(responseMetadata, "model")
    return typeof named === "string" && named !== "" ? named : asked
}

const isNumber = (entry: unknown): entry is number => typeof entry === "number"

/** The vectors of an embeddings answer, one per text; an entry that is not a list of numbers is an empty vector. */
export const vectorsOf = (answer: unknown): Array<ReadonlyArray<number>> =>
    Array.isArray(answer)
        ? answer.map((entry: unknown): ReadonlyArray<number> =>
              Array.isArray(entry) && entry.every(isNumber) ? entry : [],
          )
        : []

/** The "Business notes" block of the passages found; empty when nothing was found, so an empty brain adds nothing to the prompt. */
export const notesBlock = (passages: ReadonlyArray<ContextPassage>): string => {
    if (passages.length === 0) return ""
    const lines = passages.map((passage) => {
        const text = passage.content.replace(/\s+/gu, " ").trim().slice(0, PASSAGE_MAX_CHARS)
        return passage.title === null ? `- ${text}` : `- ${passage.title}: ${text}`
    })
    return `${NOTES_HEADING}\n${lines.join("\n")}`
}

/**
 * The prompt with the notes block as a system message of its own, right after the system messages that open the prompt and before
 * the dialogue; unchanged when the block is empty. The notes depend on the question, so they change from call to call: they never
 * enter the system text that opens the prompt, which stays the same text and so stays the prefix a provider caches.
 */
export const withNotes = (messages: ReadonlyArray<AiMessage>, block: string): Array<AiMessage> => {
    if (block === "") return [...messages]
    const dialogue = messages.findIndex((message) => message.role !== "system")
    const opening = dialogue < 0 ? messages.length : dialogue
    return [...messages.slice(0, opening), { role: "system", content: block }, ...messages.slice(opening)]
}
