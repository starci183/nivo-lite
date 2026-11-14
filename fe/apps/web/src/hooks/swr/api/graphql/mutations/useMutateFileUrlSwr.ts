"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import { valueOfJsonText } from "@/modules/workbench-host"
import { queryFileUrl } from "@/modules/api/graphql/queries/query-file-url"

/** The SWR key of the file address call. */
export const MUTATE_FILE_URL_SWR_KEY = "MUTATE_FILE_URL_SWR"

/** What one run takes: the door's file call (`via`, the record field and, for a list field, the file's `key`). */
type Arg = Omit<Parameters<typeof queryFileUrl>[0], "signal">

/** What SWR hands the fetcher. */
interface TriggerArg {
    readonly arg: Arg
}

/**
 * The signed address of a record's file: asked on demand and again before it expires, never cached, so it is a trigger and not a read:
 * `trigger(arg)` answers the JSON the back end sent and rejects with its failure.
 */
export const useMutateFileUrlSwr = (): SWRMutationResponse<unknown, Error, typeof MUTATE_FILE_URL_SWR_KEY, Arg> =>
    useSWRMutation(MUTATE_FILE_URL_SWR_KEY, async (_key: string, { arg }: TriggerArg) =>
        valueOfJsonText(answeredData(await queryFileUrl(arg), "fileUrl").fileUrl.data),
    )
