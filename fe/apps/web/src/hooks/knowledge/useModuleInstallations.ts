import { useMemo } from "react"
import { useQueryModuleInstallationsSwr } from "@/hooks/swr/api/graphql/queries/useQueryModuleInstallationsSwr"
import { toWireInstallation } from "@/modules/documents"

/** The installed agents (instances) of the active workspace, in the shape the blocks know. */
export const useModuleInstallations = () => {
    const { data, error, isLoading } = useQueryModuleInstallationsSwr()
    const installations = useMemo(
        () =>
            data === undefined
                ? undefined
                : data.flatMap((row) => {
                      const installation = toWireInstallation(row)
                      return installation === null ? [] : [installation]
                  }),
        [data],
    )
    return { installations, error, isLoading }
}
