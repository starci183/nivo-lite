"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import { valueOfJsonText } from "@/modules/workbench-host"
import { mutateFileUpload } from "@/modules/api/graphql/mutations/mutation-file-upload"

/** The SWR key of the file upload mutation. */
export const MUTATE_FILE_UPLOAD_SWR_KEY = "MUTATE_FILE_UPLOAD_SWR"

/** What one run takes: the door's file call (`via`, the record field and what the step adds). */
type Arg = Omit<Parameters<typeof mutateFileUpload>[0], "signal">

/** What SWR hands the fetcher. */
interface TriggerArg {
    readonly arg: Arg
}

/** The ticket step of an upload through the back end door: `trigger(arg)` answers the JSON the back end sent and rejects with its failure. */
export const useMutateFileUploadSwr = (): SWRMutationResponse<unknown, Error, typeof MUTATE_FILE_UPLOAD_SWR_KEY, Arg> =>
    useSWRMutation(MUTATE_FILE_UPLOAD_SWR_KEY, async (_key: string, { arg }: TriggerArg) =>
        valueOfJsonText(answeredData(await mutateFileUpload(arg), "fileUpload").fileUpload.data),
    )
