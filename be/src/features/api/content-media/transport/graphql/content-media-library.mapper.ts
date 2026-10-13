import type { ContentLibraryFile } from "@modules/domain/content-media"
import type { ListContentMediaLibraryRequest } from "../../application/list-content-media-library.contracts"
import type { ContentMediaLibraryInput } from "./dto/content-media-library.input"
import type { ContentMediaRefType } from "./dto/content-media-ref.type"

/** Maps the workspace selector and list bounds to the application request. */
export const toContentMediaLibraryRequest = (
    workspaceId: string,
    input: ContentMediaLibraryInput,
): ListContentMediaLibraryRequest => ({
    workspaceId,
    limit: input.limit,
})

/** Maps the listed objects to the GraphQL file references. */
export const toContentMediaLibraryType = (result: ReadonlyArray<ContentLibraryFile>): Array<ContentMediaRefType> =>
    result.map((file) => ({ ...file }))
