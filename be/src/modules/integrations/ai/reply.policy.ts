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

/**
 * What a call used, read from LangChain: tokens from the message `usage_metadata` (input, output, total) or the `tokenUsage` of the
 * response metadata, the cost from the raw usage object the endpoint sent (OpenRouter and the gateway report `cost`).
 */
export const usageOf = (usageMetadata: unknown, responseMetadata: unknown): AiUsage => {
    const tokenUsage = fieldOf(responseMetadata, "tokenUsage")
    const raw = fieldOf(responseMetadata, "usage")
    return {
        promptTokens: firstNumber(fieldOf(usageMetadata, "input_tokens"), fieldOf(tokenUsage, "promptTokens")),
        completionTokens: firstNumber(fieldOf(usageMetadata, "output_tokens"), fieldOf(tokenUsage, "completionTokens")),
        totalTokens: firstNumber(fieldOf(usageMetadata, "total_tokens"), fieldOf(tokenUsage, "totalTokens")),
        costUsd: numberOf(fieldOf(raw, "cost")),
    }
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

/** The model that answered, from the response metadata; the asked model when the endpoint did not say. */
export const modelOf = (responseMetadata: unknown, asked: string): string => {
    const named = fieldOf(responseMetadata, "model_name") ?? fieldOf(responseMetadata, "model")
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

/** The prompt with the notes block appended to its system message (or opening it as one); unchanged when the block is empty. */
export const withNotes = (messages: ReadonlyArray<AiMessage>, block: string): Array<AiMessage> => {
    if (block === "") return [...messages]
    const index = messages.findIndex((message) => message.role === "system")
    if (index < 0) return [{ role: "system", content: block }, ...messages]
    return messages.map((message, at) =>
        at === index ? { role: message.role, content: `${message.content}\n\n${block}` } : message,
    )
}
