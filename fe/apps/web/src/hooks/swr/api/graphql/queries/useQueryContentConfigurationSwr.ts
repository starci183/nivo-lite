import { queryContentConfiguration } from "@/modules/api/graphql/queries/query-content-configuration"
import { useWorkspaceQuerySwr } from "@/hooks/reuseables/useWorkspaceQuerySwr"

/** The SWR key of the contentConfiguration query. */
export const QUERY_CONTENT_CONFIGURATION_SWR_KEY = "QUERY_CONTENT_CONFIGURATION_SWR"

/** The content configuration of the workspace. */
export const useQueryContentConfigurationSwr = () =>
    useWorkspaceQuerySwr(
        QUERY_CONTENT_CONFIGURATION_SWR_KEY,
        [],
        () => queryContentConfiguration(),
        (data) => data.contentConfiguration,
    )
