"use client"

import useSWRMutation from "swr/mutation"
import { mutateAssignDossierFinding } from "@/modules/api/graphql/mutations/mutation-assign-dossier-finding"
import type { MutateAssignDossierFindingRequest } from "@/modules/api/graphql/mutations/mutation-assign-dossier-finding"

/** What the AssignDossierFinding mutation is triggered with. */
interface AssignDossierFindingArg {
    readonly arg: MutateAssignDossierFindingRequest
}

/** The SWR key of the assignDossierFinding mutation. */
export const MUTATE_ASSIGN_DOSSIER_FINDING_SWR_KEY = "MUTATE_ASSIGN_DOSSIER_FINDING_SWR"

/** SWR mutation for {@link mutateAssignDossierFinding}: gives a finding to a member of the workspace, with an optional due date. `trigger(input)` rejects with the back end failure. */
export const useMutateAssignDossierFindingSwr = () =>
    useSWRMutation(MUTATE_ASSIGN_DOSSIER_FINDING_SWR_KEY, async (_key: string, { arg }: AssignDossierFindingArg) => {
        const result = await mutateAssignDossierFinding({ request: arg })
        if (!result.data) throw new Error("assignDossierFinding answered no data")
        return result.data.assignDossierFinding
    })
