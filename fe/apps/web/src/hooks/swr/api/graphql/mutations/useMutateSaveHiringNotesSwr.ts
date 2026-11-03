"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveHiringNotes } from "@/modules/api/graphql/mutations/mutation-save-hiring-notes"
import type { MutateSaveHiringNotesRequest } from "@/modules/api/graphql/mutations/mutation-save-hiring-notes"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the saveHiringNotes mutation is triggered with. */
interface SaveHiringNotesArg {
    readonly arg: MutateSaveHiringNotesRequest
}

/** The SWR key of the `saveHiringNotes` mutation. */
export const MUTATE_SAVE_HIRING_NOTES_SWR_KEY = "MUTATE_SAVE_HIRING_NOTES_SWR"

/** SWR mutation for {@link mutateSaveHiringNotes}: `trigger(request)` answers `saveHiringNotes` and rejects with the back end failure. */
export const useMutateSaveHiringNotesSwr = (): SWRMutationResponse<
    OperationData<typeof mutateSaveHiringNotes>["saveHiringNotes"],
    Error,
    typeof MUTATE_SAVE_HIRING_NOTES_SWR_KEY,
    SaveHiringNotesArg["arg"]
> =>
    useSWRMutation(MUTATE_SAVE_HIRING_NOTES_SWR_KEY, async (_key: string, { arg }: SaveHiringNotesArg) => {
        const result = await mutateSaveHiringNotes({ request: arg })
        if (!result.data) throw new Error("saveHiringNotes answered no data")
        return result.data.saveHiringNotes
    })
