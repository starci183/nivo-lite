import { mutateCreateVideoMediaUpload } from "@/modules/api/graphql/mutations/mutation-create-video-media-upload"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the createVideoMediaUpload mutation. */
export const MUTATE_CREATE_VIDEO_MEDIA_UPLOAD_SWR_KEY = "MUTATE_CREATE_VIDEO_MEDIA_UPLOAD_SWR"

/** SWR mutation for {@link mutateCreateVideoMediaUpload}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCreateVideoMediaUploadSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_CREATE_VIDEO_MEDIA_UPLOAD_SWR_KEY,
        mutateCreateVideoMediaUpload,
        (data) => data.createVideoMediaUpload,
    )
