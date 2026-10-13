import useSWRMutation from "swr/mutation"
import { mutateSaveAuthorityRule } from "@/modules/api/graphql/mutations/mutation-save-authority-rule"
import type { MutateSaveAuthorityRuleRequest } from "@/modules/api/graphql/mutations/mutation-save-authority-rule"

/** What the SaveAuthorityRule mutation is triggered with. */
interface SaveAuthorityRuleArg {
    readonly arg: MutateSaveAuthorityRuleRequest
}

/** The SWR key of {@link useMutateSaveAuthorityRuleSwr}. */
export const MUTATE_SAVE_AUTHORITY_RULE_SWR_KEY = "MUTATE_SAVE_AUTHORITY_RULE_SWR"

/** SWR mutation for {@link mutateSaveAuthorityRule}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSaveAuthorityRuleSwr = () =>
    useSWRMutation(MUTATE_SAVE_AUTHORITY_RULE_SWR_KEY, async (_key: string, { arg }: SaveAuthorityRuleArg) => {
        const result = await mutateSaveAuthorityRule({ request: arg })
        if (!result.data) throw new Error("saveAuthorityRule answered no data")
        return result.data.saveAuthorityRule
    })
