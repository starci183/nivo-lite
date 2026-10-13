import { isManager, useMember } from "@/hooks/member"
import { useAuthoritySheet } from "./useAuthoritySheet"
import { useSaveAuthority } from "./useSaveAuthority"
import { EMPTY_PROFILE } from "@/modules/authority"
import type { StoredRule } from "@/modules/authority"

const NO_RULES: ReadonlyArray<StoredRule> = []

/** What every authority section needs: the stored profile and rules (empty while loading), who may edit and the profile save. */
export const useAuthoritySection = () => {
    const member = useMember()
    const { slot, reload } = useAuthoritySheet()
    const { save, isSaving } = useSaveAuthority()
    return {
        slot,
        reload,
        profile: slot.items?.profile ?? EMPTY_PROFILE,
        rules: slot.items?.rules ?? NO_RULES,
        isLocked: !isManager(member),
        save,
        isSaving,
    }
}
