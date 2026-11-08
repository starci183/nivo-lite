"use client"

import { answeredData, argumentKey, type ReadResponse } from "@/hooks/workspaceread"
import useSWR, { type SWRConfiguration } from "swr"
import { queryLoadCsvImport } from "@/modules/api/graphql/queries/query-load-csv-import"
import type { LoadCsvImportQuery } from "@/modules/api"

/** The SWR key of the loadCsvImport query. */
export const QUERY_LOAD_CSV_IMPORT_SWR_KEY = "QUERY_LOAD_CSV_IMPORT_SWR"

/** The saved setup of one import (resume). The key carries the connection; `undefined` pauses it. */
export const useQueryLoadCsvImportSwr = (
    connectionId: string | undefined,
    options?: SWRConfiguration,
): ReadResponse<LoadCsvImportQuery["loadCsvImport"]> =>
    useSWR(
        argumentKey(QUERY_LOAD_CSV_IMPORT_SWR_KEY, connectionId),
        async ([, input]: readonly [string, NonNullable<typeof connectionId>]) =>
            answeredData(await queryLoadCsvImport({ request: { connectionId: input } }), QUERY_LOAD_CSV_IMPORT_SWR_KEY)
                .loadCsvImport,
        options,
    )
