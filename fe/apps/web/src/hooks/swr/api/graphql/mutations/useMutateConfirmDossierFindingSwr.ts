"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateConfirmDossierFinding,
    type MutateConfirmDossierFindingRequest,
} from "@/modules/api/graphql/mutations/mutation-confirm-dossier-finding"
import type { ConfirmDossierFindingMutation } from "@/modules/api"

/** What the ConfirmDossierFinding mutation is triggered with. */
interface ConfirmDossierFindingArg {
    readonly arg: MutateConfirmDossierFindingRequest
}

/** The SWR key of the confirmDossierFinding mutation. */
export const MUTATE_CONFIRM_DOSSIER_FINDING_SWR_KEY = "MUTATE_CONFIRM_DOSSIER_FINDING_SWR"

/** SWR mutation for {@link mutateConfirmDossierFinding}: confirms an open finding, with an optional note. `trigger(input)` rejects with the back end failure. */
export const useMutateConfirmDossierFindingSwr = (): SWRMutationResponse<
    ConfirmDossierFindingMutation["confirmDossierFinding"],
    Error,
    typeof MUTATE_CONFIRM_DOSSIER_FINDING_SWR_KEY,
    ConfirmDossierFindingArg["arg"]
> =>
    useSWRMutation(MUTATE_CONFIRM_DOSSIER_FINDING_SWR_KEY, async (_key: string, { arg }: ConfirmDossierFindingArg) => {
        const result = await mutateConfirmDossierFinding({ request: arg })
        if (!result.data) throw new Error("confirmDossierFinding answered no data")
        return result.data.confirmDossierFinding
    })
