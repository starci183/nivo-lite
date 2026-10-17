"use client"

import { argumentKey, answeredData } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryLoadCsvImport } from "@/modules/api/graphql/queries/query-load-csv-import"

/** The SWR key of the loadCsvImport query. */
export const QUERY_LOAD_CSV_IMPORT_SWR_KEY = "QUERY_LOAD_CSV_IMPORT_SWR"

/** The saved setup of one import (resume). The key carries the connection; `undefined` pauses it. */
export const useQueryLoadCsvImportSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useSWR(
        argumentKey(QUERY_LOAD_CSV_IMPORT_SWR_KEY, connectionId),
        async ([, input]: readonly [string, NonNullable<typeof connectionId>]) =>
            answeredData(await queryLoadCsvImport({ request: { connectionId: input } }), QUERY_LOAD_CSV_IMPORT_SWR_KEY)
                .loadCsvImport,
        options,
    )
