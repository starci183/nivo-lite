"use client"

import useSWRMutation from "swr/mutation"
import { mutateConfirmDossierFinding } from "@/modules/api/graphql/mutations/mutation-confirm-dossier-finding"
import type { MutateConfirmDossierFindingRequest } from "@/modules/api/graphql/mutations/mutation-confirm-dossier-finding"

/** What the ConfirmDossierFinding mutation is triggered with. */
interface ConfirmDossierFindingArg {
    readonly arg: MutateConfirmDossierFindingRequest
}

/** The SWR key of the confirmDossierFinding mutation. */
export const MUTATE_CONFIRM_DOSSIER_FINDING_SWR_KEY = "MUTATE_CONFIRM_DOSSIER_FINDING_SWR"

/** SWR mutation for {@link mutateConfirmDossierFinding}: confirms an open finding, with an optional note. `trigger(input)` rejects with the back end failure. */
export const useMutateConfirmDossierFindingSwr = () =>
    useSWRMutation(MUTATE_CONFIRM_DOSSIER_FINDING_SWR_KEY, async (_key: string, { arg }: ConfirmDossierFindingArg) => {
        const result = await mutateConfirmDossierFinding({ request: arg })
        if (!result.data) throw new Error("confirmDossierFinding answered no data")
        return result.data.confirmDossierFinding
    })
