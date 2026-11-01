"use client"

import { mutateRequestOfficeFileUpload } from "@/modules/api/graphql/mutations/mutation-request-office-file-upload"
import type { mutateRequestOfficeFileUpload as MutateRequestOfficeFileUploadOperation } from "@/modules/api/graphql/mutations/mutation-request-office-file-upload"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the requestOfficeFileUpload mutation. */
export const MUTATE_REQUEST_OFFICE_FILE_UPLOAD_SWR_KEY = "MUTATE_REQUEST_OFFICE_FILE_UPLOAD_SWR"

/** SWR mutation for {@link mutateRequestOfficeFileUpload}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestOfficeFileUploadSwr = () =>
    useSWRMutation(
        MUTATE_REQUEST_OFFICE_FILE_UPLOAD_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(
                await mutateRequestOfficeFileUpload({ request: arg }),
                MUTATE_REQUEST_OFFICE_FILE_UPLOAD_SWR_KEY,
            ).requestOfficeFileUpload,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRequestOfficeFileUploadOperation>[0]["request"]
}
