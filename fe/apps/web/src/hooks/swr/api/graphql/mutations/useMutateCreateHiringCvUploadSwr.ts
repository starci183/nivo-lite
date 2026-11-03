"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateCreateHiringCvUpload,
    type MutateCreateHiringCvUploadRequest,
} from "@/modules/api/graphql/mutations/mutation-create-hiring-cv-upload"
import type { SWRMutationResponse } from "swr/mutation"
import type { CreateHiringCvUploadMutation } from "@/modules/api"

/** What the createHiringCvUpload mutation is triggered with. */
interface CreateHiringCvUploadArg {
    readonly arg: MutateCreateHiringCvUploadRequest
}

/** The SWR key of the `createHiringCvUpload` mutation. */
export const MUTATE_CREATE_HIRING_CV_UPLOAD_SWR_KEY = "MUTATE_CREATE_HIRING_CV_UPLOAD_SWR"

/** SWR mutation for {@link mutateCreateHiringCvUpload}: `trigger(request)` answers `createHiringCvUpload` and rejects with the back end failure. */
export const useMutateCreateHiringCvUploadSwr = (): SWRMutationResponse<
    CreateHiringCvUploadMutation["createHiringCvUpload"],
    Error,
    typeof MUTATE_CREATE_HIRING_CV_UPLOAD_SWR_KEY,
    CreateHiringCvUploadArg["arg"]
> =>
    useSWRMutation(MUTATE_CREATE_HIRING_CV_UPLOAD_SWR_KEY, async (_key: string, { arg }: CreateHiringCvUploadArg) => {
        const result = await mutateCreateHiringCvUpload({ request: arg })
        if (!result.data) throw new Error("createHiringCvUpload answered no data")
        return result.data.createHiringCvUpload
    })
