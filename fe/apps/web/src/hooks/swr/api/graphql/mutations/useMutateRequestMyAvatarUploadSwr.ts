"use client"

import useSWRMutation from "swr/mutation"
import { mutateRequestMyAvatarUpload } from "@/modules/api/graphql/mutations/mutation-request-my-avatar-upload"
import type { MutateRequestMyAvatarUploadRequest } from "@/modules/api/graphql/mutations/mutation-request-my-avatar-upload"

/** What the RequestMyAvatarUpload mutation is triggered with. */
interface RequestMyAvatarUploadArg {
    readonly arg: MutateRequestMyAvatarUploadRequest
}

/** The SWR key of {@link useMutateRequestMyAvatarUploadSwr}. */
export const MUTATE_REQUEST_MY_AVATAR_UPLOAD_SWR_KEY = "MUTATE_REQUEST_MY_AVATAR_UPLOAD_SWR"

/** SWR mutation for {@link mutateRequestMyAvatarUpload}: `trigger(request)` answers the upload address. */
export const useMutateRequestMyAvatarUploadSwr = () =>
    useSWRMutation(MUTATE_REQUEST_MY_AVATAR_UPLOAD_SWR_KEY, async (_key: string, { arg }: RequestMyAvatarUploadArg) => {
        const result = await mutateRequestMyAvatarUpload({ request: arg })
        if (!result.data) throw new Error("requestMyAvatarUpload answered no data")
        return result.data.requestMyAvatarUpload
    })
