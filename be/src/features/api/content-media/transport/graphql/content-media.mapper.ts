import type { ContentMediaData } from "@modules/domain/content-media"
import type { GetContentMediaRequest } from "../../application/get-content-media.contracts"
import type { ContentMediaInput } from "./dto/content-media.input"
import type { ContentMediaType } from "./dto/content-media.type"

/** Maps attachment references and the workspace selector to the read request. */
export const toContentMediaRequest = (workspaceId: string, input: ContentMediaInput): GetContentMediaRequest => ({
    workspaceId,
    paths: input.paths,
    videoIds: input.videoIds,
    limit: input.limit,
})

/** Maps the editor media to explicit GraphQL arrays and attachment addresses. */
export const toContentMediaType = (result: ContentMediaData): ContentMediaType => ({
    library: result.library.map((file) => ({ ...file })),
    videos: result.videos.map((video) => ({ ...video })),
    urls: result.urls.map((url) => ({ ...url })),
})
