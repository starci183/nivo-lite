"use client"

import { useKeyedQuerySwr } from "@/hooks/reuseables"
import type { SWRConfiguration } from "swr"
import { queryLoadCsvImport } from "@/modules/api/graphql/queries/query-load-csv-import"

/** The SWR key of the loadCsvImport query. */
export const QUERY_LOAD_CSV_IMPORT_SWR_KEY = "QUERY_LOAD_CSV_IMPORT_SWR"

/** The saved setup of one import (resume). The key carries the connection; `undefined` pauses it. */
export const useQueryLoadCsvImportSwr = (connectionId: string | undefined, options?: SWRConfiguration) =>
    useKeyedQuerySwr(
        QUERY_LOAD_CSV_IMPORT_SWR_KEY,
        connectionId,
        (id) => queryLoadCsvImport({ request: { connectionId: id } }),
        (data) => data.loadCsvImport,
        options,
    )
