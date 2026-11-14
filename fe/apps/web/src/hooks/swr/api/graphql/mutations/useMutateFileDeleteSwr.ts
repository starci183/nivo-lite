"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import { valueOfJsonText } from "@/modules/workbench-host"
import { mutateFileDelete } from "@/modules/api/graphql/mutations/mutation-file-delete"

/** The SWR key of the file delete mutation. */
export const MUTATE_FILE_DELETE_SWR_KEY = "MUTATE_FILE_DELETE_SWR"

/** What one run takes: the door's file call (`via`, the record field and what the step adds). */
type Arg = Omit<Parameters<typeof mutateFileDelete>[0], "signal">

/** What SWR hands the fetcher. */
interface TriggerArg {
    readonly arg: Arg
}

/** The removal of a record's file: `trigger(arg)` answers the JSON the back end sent and rejects with its failure. */
export const useMutateFileDeleteSwr = (): SWRMutationResponse<unknown, Error, typeof MUTATE_FILE_DELETE_SWR_KEY, Arg> =>
    useSWRMutation(MUTATE_FILE_DELETE_SWR_KEY, async (_key: string, { arg }: TriggerArg) =>
        valueOfJsonText(answeredData(await mutateFileDelete(arg), "fileDelete").fileDelete.data),
    )
