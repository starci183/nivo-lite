import type {
    SaveBookingPublicPageRequest,
    SaveBookingPublicPageResult,
} from "../../application/save-booking-public-page.contracts"
import type { SaveBookingPublicPageInput } from "./dto/save-booking-public-page.input"
import type { SaveBookingPublicPageType } from "./dto/save-booking-public-page.type"

/** Maps the GraphQL arguments to the workspace-scoped request. */
export const toSaveBookingPublicPageRequest = (
    workspaceId: string,
    input: SaveBookingPublicPageInput,
): SaveBookingPublicPageRequest => ({
    workspaceId,
    enabled: input.enabled,
    slug: input.slug,
    note: input.note,
})

/** Maps the saved identity to the GraphQL result. */
export const toSaveBookingPublicPageType = (result: SaveBookingPublicPageResult): SaveBookingPublicPageType => ({
    workspaceId: result.workspaceId,
})
