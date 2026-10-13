import { useMemo } from "react"
import { useMutateGenerateHiringAdSwr } from "@/hooks/swr/api/graphql/mutations/useMutateGenerateHiringAdSwr"
import { useMutateSetHiringJobStatusSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSetHiringJobStatusSwr"

/** The job commands of the Hiring workbench through the back end GraphQL door. */
export const useHiringJobCommands = () => {
    const { trigger: statusTrigger } = useMutateSetHiringJobStatusSwr()
    const { trigger: adTrigger } = useMutateGenerateHiringAdSwr()
    return useMemo(
        () => ({
            setStatus: (id: string, status: string) => statusTrigger({ id, status }),
            generateAd: (jobId: string) => adTrigger({ jobId }),
        }),
        [statusTrigger, adTrigger],
    )
}
