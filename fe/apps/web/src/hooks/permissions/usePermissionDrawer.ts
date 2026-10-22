"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useMember } from "@/hooks/member"
import { useQueryMemberGrantsSwr } from "@/hooks/swr"
import type { StoredRule } from "@/hooks/authority"
import { approvalPolicyOf, approverRoleOf, ruleUnitOf } from "@/modules/authority"
import {
    TIMEOUT_CHOICES,
    bandsValid,
    changeOf,
    draftOf,
    grantCandidates,
    grantMax,
    orderedPick,
} from "@/modules/permissions"
import type { Approver, GrantCandidate, GrantDraft, PermissionDraft, Strategy } from "@/modules/permissions"
import { usePermissionDrawerWords } from "./usePermissionDrawerWords"
import { useSavePermission } from "./useSavePermission"

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

const STRATEGIES: ReadonlyArray<Strategy> = ["auto", "bands", "ask", "never"]

/**
 * Opens, fills and saves the rule drawer of the Quyen page. `props` is null while the drawer is closed. Only the owner may hand
 * out approval limits (the server refuses a manager), so a manager sees them without being able to change them.
 */
export const usePermissionDrawer = (options: DrawerOptions) => {
    const t = useTranslations("permissions")
    const words = usePermissionDrawerWords()
    const isOwner = useMember()?.role === "owner"
    const [state, setState] = useState<DrawerState | null>(null)
    const grantsRead = useQueryMemberGrantsSwr(state === null ? null : { action: state.rule.action })
    const { save, isSaving } = useSavePermission()
    const change = (patch: Partial<PermissionDraft>) =>
        setState((current) => (current === null ? null : { ...current, draft: { ...current.draft, ...patch } }))

    const candidates = (): ReadonlyArray<GrantCandidate> =>
        state === null
            ? []
            : grantCandidates({
                  members: options.members,
                  draft: state.draft,
                  stored: grantsRead.data ?? [],
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
    return {
        open: (rule: StoredRule) => setState({ rule, draft: draftOf(rule), grantEdits: {} }),
        props,
        on: {
            agents: (ids: ReadonlyArray<string>) => change({ agents: ids }),
            strategy: (value: string) => {
                const strategy = STRATEGIES.find((one) => one === value)
                if (strategy !== undefined) change({ strategy })
            },
            unit: (value: string | null) =>
                change({ unit: ruleUnitOf(value ?? ""), autoMax: Number.NaN, askMax: Number.NaN }),
            autoMax: (value: number) => change({ autoMax: value }),
            askMax: (value: number) => change({ askMax: value }),
            slider: (values: ReadonlyArray<number>) =>
                change({ autoMax: values[0] ?? Number.NaN, askMax: values[1] ?? Number.NaN }),
            roles: (ids: ReadonlyArray<string>) => change({ roles: ids.flatMap((id) => approverRoleOf(id) ?? []) }),
            rooms: (ids: ReadonlyArray<string>) => change({ rooms: ids }),
            members: (ids: ReadonlyArray<string>) => change({ members: orderedPick(state?.draft.members ?? [], ids) }),
            policy: (value: string) => change({ policy: approvalPolicyOf(value) }),
            timeout: (value: string | null) => {
                const minutes = Number(value)
                if (TIMEOUT_CHOICES.includes(minutes)) change({ timeoutMinutes: minutes })
            },
            grantEnabled: (memberId: string, enabled: boolean) =>
                editGrant(memberId, (known) => ({ memberId, enabled, max: known?.max ?? Number.NaN })),
            grantMax: (memberId: string, max: number) =>
                editGrant(memberId, (known) => ({ memberId, enabled: known?.enabled ?? true, max })),
            save: saveRule,
            close: () => setState(null),
        },
    }
}
