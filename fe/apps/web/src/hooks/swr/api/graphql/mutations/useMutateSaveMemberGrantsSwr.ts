"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveMemberGrants } from "@/modules/api/graphql/mutations/mutation-save-member-grants"
import type { MutateSaveMemberGrantsRequest } from "@/modules/api/graphql/mutations/mutation-save-member-grants"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the SaveMemberGrants mutation is triggered with. */
interface SaveMemberGrantsArg {
    readonly arg: MutateSaveMemberGrantsRequest
}

/** The SWR key of {@link useMutateSaveMemberGrantsSwr}. */
export const MUTATE_SAVE_MEMBER_GRANTS_SWR_KEY = "MUTATE_SAVE_MEMBER_GRANTS_SWR"

/** SWR mutation for {@link mutateSaveMemberGrants}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSaveMemberGrantsSwr = (): SWRMutationResponse<
    OperationData<typeof mutateSaveMemberGrants>["saveMemberGrants"],
    Error,
    typeof MUTATE_SAVE_MEMBER_GRANTS_SWR_KEY,
    SaveMemberGrantsArg["arg"]
> =>
    useSWRMutation(MUTATE_SAVE_MEMBER_GRANTS_SWR_KEY, async (_key: string, { arg }: SaveMemberGrantsArg) => {
        const result = await mutateSaveMemberGrants({ request: arg })
        if (!result.data) throw new Error("saveMemberGrants answered no data")
        return result.data.saveMemberGrants
    })
