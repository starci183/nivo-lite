"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateRequestWorkspaceLogoUpload,
    type MutateRequestWorkspaceLogoUploadRequest,
} from "@/modules/api/graphql/mutations/mutation-request-workspace-logo-upload"
import type { RequestWorkspaceLogoUploadMutation } from "@/modules/api"

/** What the RequestWorkspaceLogoUpload mutation is triggered with. */
interface RequestWorkspaceLogoUploadArg {
    readonly arg: MutateRequestWorkspaceLogoUploadRequest
}

/** The SWR key of {@link useMutateRequestWorkspaceLogoUploadSwr}. */
export const MUTATE_REQUEST_WORKSPACE_LOGO_UPLOAD_SWR_KEY = "MUTATE_REQUEST_WORKSPACE_LOGO_UPLOAD_SWR"

/** SWR mutation for {@link mutateRequestWorkspaceLogoUpload}: `trigger(request)` answers the upload address. */
export const useMutateRequestWorkspaceLogoUploadSwr = (): SWRMutationResponse<
    RequestWorkspaceLogoUploadMutation["requestWorkspaceLogoUpload"],
    Error,
    typeof MUTATE_REQUEST_WORKSPACE_LOGO_UPLOAD_SWR_KEY,
    RequestWorkspaceLogoUploadArg["arg"]
> =>
    useSWRMutation(
        MUTATE_REQUEST_WORKSPACE_LOGO_UPLOAD_SWR_KEY,
        async (_key: string, { arg }: RequestWorkspaceLogoUploadArg) => {
            const result = await mutateRequestWorkspaceLogoUpload({ request: arg })
            if (!result.data) throw new Error("requestWorkspaceLogoUpload answered no data")
            return result.data.requestWorkspaceLogoUpload
        },
    )
