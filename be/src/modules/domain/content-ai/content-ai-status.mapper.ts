import type { ContentAiReviewWarning } from "./content-ai.contracts"
import type { ChannelWarning } from "./content-ai-prompt.policy"

/** Normalizes discriminated findings before they reach a thin transport mapper. */
export const toContentAiReview = ({ channel, warning }: ChannelWarning): ContentAiReviewWarning => ({
    channel,
    warning: {
        kind: warning.kind,
        phrase: warning.kind === "promise" ? warning.phrase : null,
        figure: warning.kind === "figure" ? warning.figure : null,
        length: warning.kind === "length" ? warning.length : null,
        max: warning.kind === "length" ? warning.max : null,
    },
})
