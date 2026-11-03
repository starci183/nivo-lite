"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useMember } from "@/hooks/member"
import { useQueryMemberGrantsSwr } from "@/hooks/swr"
import type { StoredRule } from "@/hooks/authority"
import { bandsValid, changeOf, draftOf, grantCandidates, grantMax } from "@/modules/permissions"
import type { Approver, GrantCandidate, GrantDraft, PermissionDraft } from "@/modules/permissions"
import { permissionEditsOf } from "./permissions.shared"
import { usePermissionDrawerWords } from "./usePermissionDrawerWords"
import { useSavePermission } from "./useSavePermission"
import { slotOfReads, useSlotLabels } from "@/hooks/slot"

/** The drawer while it is open: the rule being changed, what was typed, and the limits typed over the stored ones. */
interface DrawerState {
    readonly rule: StoredRule
    readonly draft: PermissionDraft
    readonly grantEdits: Readonly<Record<string, GrantDraft>>
}

/** What the drawer picks agents, rooms and people from. */
interface DrawerOptions {
    readonly agentOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly roomOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly members: ReadonlyArray<Approver>
}

/** Who is looking and whether a save is in flight. */
interface Viewer {
    readonly isOwner: boolean
    readonly isSaving: boolean
}

/** The active people the rule can name, as choices. */
const activeChoices = (members: ReadonlyArray<Approver>) =>
    members.filter((one) => one.isActive).map((one) => ({ id: one.id, label: one.name }))

/** What the drawer lets the user do right now with the draft as typed. */
const stateOf = (draft: PermissionDraft, who: Viewer) => ({
    draft,
    canGrant: who.isOwner,
    canSave: bandsValid(draft) && !who.isSaving,
    isBandsInvalid: !bandsValid(draft),
    isPending: who.isSaving,
})

/**
 * Opens, fills and saves the rule drawer of the Quyen page. `props` is null while the drawer is closed. Only the owner may hand
 * out approval limits (the server refuses a manager), so a manager sees them without being able to change them.
 */
export const usePermissionDrawer = (options: DrawerOptions) => {
    const t = useTranslations("permissions")
    const words = usePermissionDrawerWords()
    const slotLabels = useSlotLabels()
    const isOwner = useMember()?.role === "owner"
    const [state, setState] = useState<DrawerState | null>(null)
    const grantsRead = useQueryMemberGrantsSwr(state === null ? null : { action: state.rule.action })
    const { save, isSaving } = useSavePermission()
    const change = (patch: Partial<PermissionDraft>) =>
        setState((current) => (current === null ? null : { ...current, draft: { ...current.draft, ...patch } }))
    const stored = grantsRead.data ?? []
    const candidates = (): ReadonlyArray<GrantCandidate> =>
        state === null
            ? []
            : grantCandidates({
                  members: options.members,
                  draft: state.draft,
                  stored,
                  edits: state.grantEdits,
              })
    const editGrant = (memberId: string, edit: (known: GrantCandidate | undefined) => GrantDraft) =>
        setState((current) => {
            if (current === null) return null
            const grant = edit(candidates().find((one) => one.memberId === memberId))
            return { ...current, grantEdits: { ...current.grantEdits, [memberId]: grant } }
        })

    const saveRule = async () => {
        if (state === null) return
        const limits =
            isOwner && grantsRead.data !== undefined
                ? candidates()
                      .filter((one) => one.enabled)
                      .map((one) => ({ memberId: one.memberId, maxAmount: grantMax(one) }))
                : null
        if (await save(changeOf(state.draft), state.rule.required, limits)) setState(null)
    }

    const props =
        state === null
            ? null
            : {
                  ...words.viewOf({ rule: state.rule, draft: state.draft, isOwner }),
                  ...stateOf(state.draft, { isOwner, isSaving }),
                  grants: candidates().map((one) => ({ ...one, maxLabel: t("grantMax", { name: one.name }) })),
                  agentOptions: options.agentOptions,
                  roomOptions: options.roomOptions,
                  memberOptions: activeChoices(options.members),
              }
    const grantsSlot = slotOfReads([grantsRead], () =>
        candidates().map((one) => ({ ...one, maxLabel: t("grantMax", { name: one.name }) })),
    )
    return {
        grantsSlot,
        grantsLabels: slotLabels(t("loadFailTitle")),
        retryGrants: () => void grantsRead.mutate(),
        open: (rule: StoredRule) => setState({ rule, draft: draftOf(rule), grantEdits: {} }),
        props,
        on: {
            ...permissionEditsOf({ change, editGrant, members: state?.draft.members ?? [] }),
            save: saveRule,
            close: () => setState(null),
        },
    }
}
