"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryBrainDossiers } from "@/modules/api/graphql/queries/query-brain-dossiers"

/** The SWR key of the dossiers; mutations that change the documents revalidate the keys that lead with it. */
export const QUERY_BRAIN_DOSSIERS_SWR_KEY = "QUERY_BRAIN_DOSSIERS_SWR"

/** The dossiers the active workspace tracks, with the documents that name each (the back end `brainDossiers` query). */
export const useQueryBrainDossiersSwr = () => {
    const key = useWorkspaceKey(QUERY_BRAIN_DOSSIERS_SWR_KEY, [])
    return useSWR(key, async () => {
        const result = await queryBrainDossiers()
        if (!result.data) throw new Error("brainDossiers answered no data")
        return result.data.brainDossiers
    })
}
