"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryResponsibilities } from "@/modules/api/graphql/queries/query-responsibilities"

/** The SWR key of {@link useQueryResponsibilitiesSwr}. */
export const QUERY_RESPONSIBILITIES_SWR_KEY = "QUERY_RESPONSIBILITIES_SWR"

/** The back end `responsibilities` query. */
export const useQueryResponsibilitiesSwr = (config?: SWRConfiguration) =>
    useSWR(QUERY_RESPONSIBILITIES_SWR_KEY, async () => (await queryResponsibilities()).data?.responsibilities, config)
