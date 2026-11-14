"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import { valueOfJsonText } from "@/modules/workbench-host"
import { mutateFileLink } from "@/modules/api/graphql/mutations/mutation-file-link"

/** The SWR key of the file link mutation. */
export const MUTATE_FILE_LINK_SWR_KEY = "MUTATE_FILE_LINK_SWR"

/** What one run takes: the door's file call (`via`, the record field and what the step adds). */
type Arg = Omit<Parameters<typeof mutateFileLink>[0], "signal">

/** What SWR hands the fetcher. */
interface TriggerArg {
    readonly arg: Arg
}

/** The link step of an upload: `trigger(arg)` answers the JSON the back end sent and rejects with its failure. */
export const useMutateFileLinkSwr = (): SWRMutationResponse<unknown, Error, typeof MUTATE_FILE_LINK_SWR_KEY, Arg> =>
    useSWRMutation(MUTATE_FILE_LINK_SWR_KEY, async (_key: string, { arg }: TriggerArg) =>
        valueOfJsonText(answeredData(await mutateFileLink(arg), "fileLink").fileLink.data),
    )
