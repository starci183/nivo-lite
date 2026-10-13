import { mutateRequestContentMediaUpload } from "@/modules/api/graphql/mutations/mutation-request-content-media-upload"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the requestContentMediaUpload mutation. */
export const MUTATE_REQUEST_CONTENT_MEDIA_UPLOAD_SWR_KEY = "MUTATE_REQUEST_CONTENT_MEDIA_UPLOAD_SWR"

/** SWR mutation for {@link mutateRequestContentMediaUpload}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestContentMediaUploadSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_REQUEST_CONTENT_MEDIA_UPLOAD_SWR_KEY,
        mutateRequestContentMediaUpload,
        (data) => data.requestContentMediaUpload,
    )
