import { approvalPolicyOf, approverRoleOf, ruleUnitOf } from "@/modules/authority"
import {
    TIMEOUT_CHOICES,
    orderedPick,
    type GrantCandidate,
    type GrantDraft,
    type PermissionDraft,
    type Strategy,
} from "@/modules/permissions"

const STRATEGIES: ReadonlyArray<Strategy> = ["auto", "bands", "ask", "never"]

/** What the edits of the drawer change: the draft of the rule and the limit typed over one member's stored limit. */
interface PermissionEditTargets {
    readonly change: (patch: Partial<PermissionDraft>) => void
    readonly editGrant: (memberId: string, edit: (known: GrantCandidate | undefined) => GrantDraft) => void
    /** The members the rule names now, in the order they were picked. */
    readonly members: ReadonlyArray<string>
}

/** The commands that edit what the drawer holds; each hands one typed value to the draft. */
export const permissionEditsOf = (targets: PermissionEditTargets) => {
    const { change, editGrant } = targets
    return {
        agents: (ids: ReadonlyArray<string>): void => change({ agents: ids }),
        strategy: (value: string): void => {
            const strategy = STRATEGIES.find((one) => one === value)
            if (strategy !== undefined) change({ strategy })
        },
        unit: (value: string | null): void =>
            change({ unit: ruleUnitOf(value ?? ""), autoMax: Number.NaN, askMax: Number.NaN }),
        autoMax: (value: number): void => change({ autoMax: value }),
        askMax: (value: number): void => change({ askMax: value }),
        slider: (values: ReadonlyArray<number>): void =>
            change({ autoMax: values[0] ?? Number.NaN, askMax: values[1] ?? Number.NaN }),
        roles: (ids: ReadonlyArray<string>): void => change({ roles: ids.flatMap((id) => approverRoleOf(id) ?? []) }),
        rooms: (ids: ReadonlyArray<string>): void => change({ rooms: ids }),
        members: (ids: ReadonlyArray<string>): void => change({ members: orderedPick(targets.members, ids) }),
        policy: (value: string): void => change({ policy: approvalPolicyOf(value) }),
        timeout: (value: string | null): void => {
            const minutes = Number(value)
            if (TIMEOUT_CHOICES.includes(minutes)) change({ timeoutMinutes: minutes })
        },
        grantEnabled: (memberId: string, enabled: boolean): void =>
            editGrant(memberId, (known) => ({ memberId, enabled, max: known?.max ?? Number.NaN })),
        grantMax: (memberId: string, max: number): void =>
            editGrant(memberId, (known) => ({ memberId, enabled: known?.enabled ?? true, max })),
    }
}
