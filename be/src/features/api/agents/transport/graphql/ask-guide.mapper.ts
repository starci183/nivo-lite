import type { GenerationEnqueued, GuideAsk } from "@modules/domain/ai-generations"
import type { Locale } from "@modules/platform/i18n"
import type { AskGuideInput } from "./dto/ask-guide.input"
import type { GuideAskedType } from "./dto/guide-asked.type"

/** Maps the GraphQL input, with the workspace it names and the request language, to the command request. */
export const toAskGuideRequest = (workspaceId: string, input: AskGuideInput, locale: Locale): GuideAsk => ({
    workspaceId,
    question: input.question,
    path: input.path,
    history: input.history.map((turn) => ({ role: turn.role, text: turn.text })),
    locale,
})

/** Maps the queued text to its GraphQL type. */
export const toGuideAskedType = (queued: GenerationEnqueued): GuideAskedType => ({
    generationId: queued.id,
    status: queued.status,
})
