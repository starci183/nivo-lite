import type { ContentPublishedResult } from "@modules/domain/content-items"
import type { MarkContentPublishedRequest } from "@modules/domain/content-publishing"
import type { Locale } from "@modules/platform/i18n"
import type { MarkContentPublishedInput } from "./dto/mark-content-published.input"
import type { MarkContentPublishedType } from "./dto/mark-content-published.type"

/** Maps bounded proof together with trusted request context. */
export const toMarkContentPublishedRequest = (
    workspaceId: string,
    locale: Locale,
    input: MarkContentPublishedInput,
): MarkContentPublishedRequest => ({
    workspaceId,
    locale,
    id: input.id,
    channel: input.channel,
    url: input.url,
    how: input.how,
})

/** Exposes saved proof completeness without a response envelope. */
export const toMarkContentPublishedType = (result: ContentPublishedResult): MarkContentPublishedType => ({
    id: result.id,
    allDone: result.allDone,
})
