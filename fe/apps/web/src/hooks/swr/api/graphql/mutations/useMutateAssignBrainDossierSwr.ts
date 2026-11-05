"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateAssignBrainDossier,
    type MutateAssignBrainDossierRequest,
} from "@/modules/api/graphql/mutations/mutation-assign-brain-dossier"
import type { SWRMutationResponse } from "swr/mutation"
import type { AssignBrainDossierMutation } from "@/modules/api"

/** What the AssignBrainDossier mutation is triggered with. */
interface AssignBrainDossierArg {
    readonly arg: MutateAssignBrainDossierRequest
}

/** The SWR key of the assignBrainDossier mutation. */
export const MUTATE_ASSIGN_BRAIN_DOSSIER_SWR_KEY = "MUTATE_ASSIGN_BRAIN_DOSSIER_SWR"

/** SWR mutation for {@link mutateAssignBrainDossier}: gives a dossier to a member of the workspace with an optional due date, or takes both back. `trigger(input)` rejects with the back end failure. */
export const useMutateAssignBrainDossierSwr = (): SWRMutationResponse<
    AssignBrainDossierMutation["assignBrainDossier"],
    Error,
    typeof MUTATE_ASSIGN_BRAIN_DOSSIER_SWR_KEY,
    AssignBrainDossierArg["arg"]
> =>
    useSWRMutation(MUTATE_ASSIGN_BRAIN_DOSSIER_SWR_KEY, async (_key: string, { arg }: AssignBrainDossierArg) => {
        const result = await mutateAssignBrainDossier({ request: arg })
        if (!result.data) throw new Error("assignBrainDossier answered no data")
        return result.data.assignBrainDossier
    })
