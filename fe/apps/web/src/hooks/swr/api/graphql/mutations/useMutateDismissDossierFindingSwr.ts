"use client"

import useSWRMutation from "swr/mutation"
import { mutateDismissDossierFinding } from "@/modules/api/graphql/mutations/mutation-dismiss-dossier-finding"
import type { MutateDismissDossierFindingRequest } from "@/modules/api/graphql/mutations/mutation-dismiss-dossier-finding"

/** What the DismissDossierFinding mutation is triggered with. */
interface DismissDossierFindingArg {
    readonly arg: MutateDismissDossierFindingRequest
}

/** The SWR key of the dismissDossierFinding mutation. */
export const MUTATE_DISMISS_DOSSIER_FINDING_SWR_KEY = "MUTATE_DISMISS_DOSSIER_FINDING_SWR"

/** SWR mutation for {@link mutateDismissDossierFinding}: dismisses a finding, with the reason that keeps NIVO from raising it again while the documents stay the same. `trigger(input)` rejects with the back end failure. */
export const useMutateDismissDossierFindingSwr = () =>
    useSWRMutation(MUTATE_DISMISS_DOSSIER_FINDING_SWR_KEY, async (_key: string, { arg }: DismissDossierFindingArg) => {
        const result = await mutateDismissDossierFinding({ request: arg })
        if (!result.data) throw new Error("dismissDossierFinding answered no data")
        return result.data.dismissDossierFinding
    })
