"use client"

import useSWRInfinite from "swr/infinite"
import type { SWRInfiniteKeyLoader } from "swr/infinite"
import { connectionPageKey, connectionPageView, connectionReadParameters } from "@/hooks/connectionPages"
import type { ConnectionPage } from "@/hooks/connectionPages"
import { noData } from "@/hooks/workspaceread"
import { GraphQLHeadersKey } from "@/modules/api"
import type { DossierFindingsQuery } from "@/modules/api"
import { queryDossierFindings } from "@/modules/api/graphql/queries/query-dossier-findings"
import type { QueryDossierFindingsRequest } from "@/modules/api/graphql/queries/query-dossier-findings"

/** The dossier findings connection cache; every loaded page of every filter leads with it. */
export const QUERY_DOSSIER_FINDINGS_SWR_KEY = "QUERY_DOSSIER_FINDINGS_SWR"

/** What narrows the findings read: the request without its paging. */
export type DossierFindingsFilter = Omit<QueryDossierFindingsRequest, "first" | "after">

type DossierFindingsPage = ConnectionPage<DossierFindingsQuery["dossierFindings"]["nodes"][number]>

/** The identity of one page: its name, workspace, position and the filter it answers. */
type DossierFindingsPageKey = readonly [name: string, workspaceId: string, after: string | null, filter: string]

/**
 * Reads the loaded pages of the findings of the active workspace that match the filter; a new filter starts from the first page.
 * A new `revision` (what the caller knows changed the findings, such as a review run ending) reads them again.
 */
export const useQueryDossierFindingsSwr = (
    workspaceId: string | undefined,
    filter: DossierFindingsFilter,
    revision = "",
) => {
    const filterKey = JSON.stringify([filter, revision])
    const getKey: SWRInfiniteKeyLoader<DossierFindingsPage, DossierFindingsPageKey | null> = (index, previous) => {
        const page = connectionPageKey(QUERY_DOSSIER_FINDINGS_SWR_KEY, workspaceId, index, previous)
        return page === null ? null : [page[0], page[1], page[2], filterKey]
    }
    const query = useSWRInfinite<DossierFindingsPage, Error>(
        getKey,
        async ([name, id, after]: DossierFindingsPageKey) => {
            const parameters = connectionReadParameters([name, id, after], GraphQLHeadersKey.XWorkspaceId)
            const result = await queryDossierFindings({
                request: { ...filter, ...parameters.request },
                headers: parameters.headers,
            })
            return result.data?.dossierFindings ?? noData("dossierFindings")
        },
        { persistSize: false, keepPreviousData: false, revalidateAll: true },
    )
    return connectionPageView(query)
}
