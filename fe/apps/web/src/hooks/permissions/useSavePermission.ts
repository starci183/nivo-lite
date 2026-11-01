"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { mutate } from "@/modules/viewer-cache"
import {
    QUERY_AUTHORITY_SWR_KEY,
    QUERY_MEMBER_GRANTS_SWR_KEY,
    useMutateSaveAuthorityRuleSwr,
    useMutateSaveMemberGrantsSwr,
} from "@/hooks/swr"
import type { MutateSaveMemberGrantsRequest } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { matchesSwrKey } from "@/modules/utils"
import type { PermissionChange } from "@/modules/permissions"

/** The limits one save carries: the members who may approve and the largest amount each may approve. */
export type GrantsChange = MutateSaveMemberGrantsRequest["grants"]

/** True for the SWR keys of the approval limits, so a save reads them afresh. */
const isGrantsKey = (key: unknown): boolean => Array.isArray(key) && key[0] === QUERY_MEMBER_GRANTS_SWR_KEY

/**
 * Saves one rule of the Quyen page: the rule first, then (for the owner, who alone may hand out approval limits) the limits of the
 * members. One toast for the whole save; the rules and the limits are read again afterwards. Answers whether it all saved.
 */
export const useSavePermission = () => {
    const t = useTranslations("permissions")
    const runGraphQL = useGraphQLWithToast()
    const rule = useMutateSaveAuthorityRuleSwr()
    const grants = useMutateSaveMemberGrantsSwr()
    const save = useCallback(
        async (
            change: PermissionChange,
            required: ReadonlyArray<string>,
            limits: GrantsChange | null,
        ): Promise<boolean> => {
            const done = await runGraphQL(
                async () => {
                    await rule.trigger({
                        change: {
                            action: change.action,
                            department: change.department,
                            mode: change.mode,
                            required_fields: [...required],
                            unit: change.unit,
                            auto_max: change.autoMax,
                            ask_max: change.askMax,
                            agents: [...change.agents],
                            approver_roles: [...change.roles],
                            approver_rooms: [...change.rooms],
                            approver_members: [...change.members],
                            approval_policy: change.policy,
                            timeout_minutes: change.timeoutMinutes,
                        },
                    })
                    if (limits !== null) await grants.trigger({ action: change.action, grants: [...limits] })
                    return true
                },
                { successMessage: t("saved") },
            )
            await mutate(matchesSwrKey(QUERY_AUTHORITY_SWR_KEY))
            await mutate(isGrantsKey)
            return done !== undefined
        },
        [runGraphQL, rule, grants, t],
    )
    return { save, isSaving: rule.isMutating || grants.isMutating }
}
