import type { ContentFigures } from "@modules/domain/content-items"
import type { ContentFiguresType } from "./dto/content-figures.type"

/** Maps the workbench counts to the GraphQL figures type. */
export const toContentFiguresType = (result: ContentFigures): ContentFiguresType => ({
    awaitingApproval: result.awaitingApproval,
    published30: result.published30,
    next: result.next,
    pillars: { ...result.pillars },
})
