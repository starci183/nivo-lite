import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryModuleInstallations } from "@/modules/api/graphql/queries/query-module-installations"

/** The SWR key of {@link useQueryModuleInstallationsSwr}. */
export const QUERY_MODULE_INSTALLATIONS_SWR_KEY = "QUERY_MODULE_INSTALLATIONS_SWR"

/** The back end `moduleInstallations` query. */
export const useQueryModuleInstallationsSwr = (config?: SWRConfiguration) =>
    useSWR(
        QUERY_MODULE_INSTALLATIONS_SWR_KEY,
        async () => (await queryModuleInstallations()).data?.moduleInstallations,
        config,
    )
