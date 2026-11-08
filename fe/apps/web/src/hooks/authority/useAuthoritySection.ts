import { isManager, useMember } from "@/hooks/member"
import { useAuthoritySheet } from "./useAuthoritySheet"
import { useSaveAuthority, type AuthorityPatch } from "./useSaveAuthority"
import { EMPTY_PROFILE, type AuthoritySheet, type AuthorityProfile, type StoredRule } from "@/modules/authority"
import type { DataSlot } from "@/modules/types"
import type { SWRResponse } from "swr"

const NO_RULES: ReadonlyArray<StoredRule> = []

/** The view `useAuthoritySection` returns. */
export interface AuthoritySectionViewShape {
    slot: DataSlot<AuthoritySheet>
    read: SWRResponse<
        {
            profile: {
                brand_voice: string
                goal_first_reply_minutes: number | null
                goal_new_customers: number | null
                goal_note: string
                goal_revenue_vnd: number | null
                limits_note: string
                policies: string
                reply_style: string
                updated_at: string
                updated_by: string | null
            } | null
            rules: Array<{
                action: string
                agents: Array<string>
                approval_policy: string
                approver_members: Array<string>
                approver_roles: Array<string>
                approver_rooms: Array<string>
                ask_max: number | null
                auto_max: number | null
                department: string
                id: string
                limit_vnd: number | null
                mode: string
                note: string
                required_fields: Array<string>
                timeout_minutes: number
                unit: string
                updated_at: string
                workspace_id: string
            }>
        },
        Error
    >
    reload: () => void
    profile: AuthorityProfile
    rules: readonly StoredRule[]
    isLocked: boolean
    save: (patch: AuthorityPatch) => Promise<boolean>
    isSaving: boolean
}

/** What every authority section needs: the stored profile and rules (empty while loading), who may edit and the profile save. */
export const useAuthoritySection = (): AuthoritySectionViewShape => {
    const member = useMember()
    const { slot, read, reload } = useAuthoritySheet()
    const { save, isSaving } = useSaveAuthority()
    return {
        slot,
        read,
        reload,
        profile: "items" in slot ? slot.items.profile : EMPTY_PROFILE,
        rules: "items" in slot ? slot.items.rules : NO_RULES,
        isLocked: !isManager(member),
        save,
        isSaving,
    }
}
