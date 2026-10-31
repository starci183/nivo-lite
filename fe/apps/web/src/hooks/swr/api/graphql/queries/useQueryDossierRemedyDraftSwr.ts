"use client"

import useSWR from "swr"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryDossierRemedyDraft } from "@/modules/api/graphql/queries/query-dossier-remedy-draft"

/** The SWR key of one remedy draft; a write that changes the draft revalidates the keys that lead with it. */
export const QUERY_DOSSIER_REMEDY_DRAFT_SWR_KEY = "QUERY_DOSSIER_REMEDY_DRAFT_SWR"

/** How often the draft is asked again while NIVO is still writing it. */
const GENERATING_REFRESH_MS = 4_000

/** One remedy draft of the active workspace (the back end `dossierRemedyDraft` query); null when it is gone. Asked again every few seconds only while NIVO is writing it. */
export const useQueryDossierRemedyDraftSwr = (id: string | undefined) => {
    const key = useWorkspaceKey(QUERY_DOSSIER_REMEDY_DRAFT_SWR_KEY, [id ?? ""], id !== undefined)
    return useSWR(
        key,
        async ([, , draftId]: WorkspaceReadKey<string>, { signal }: { signal?: AbortSignal } = {}) => {
            const result = await queryDossierRemedyDraft({ request: { input: { draftId } }, signal })
            if (!result.data) throw new Error("dossierRemedyDraft answered no data")
            return result.data.dossierRemedyDraft
        },
        { refreshInterval: (data) => (data?.status === "generating" ? GENERATING_REFRESH_MS : 0) },
    )
}
