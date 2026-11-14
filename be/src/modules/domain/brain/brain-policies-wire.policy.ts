import type { PolicyProposalView, PolicyValueView } from "./brain-policies.contracts"
import type {
    BrainPoliciesWire,
    BrainPolicyDetailWire,
    BrainPolicyParameterWire,
    BrainPolicyProposalWire,
    BrainPolicyRowWire,
    BrainPolicyValueWire,
} from "./brain-policies-wire.contracts"
import type { DerivedBrainPolicies, DerivedBrainPolicyDetail, DerivedPolicyRow } from "./policy-derived-view.policy"
import type { PolicyValue } from "./policy-value.policy"

/** Every field of a parameter, null. */
const NONE: Omit<BrainPolicyParameterWire, "type"> = {
    amountVnd: null,
    per: null,
    percent: null,
    minutes: null,
    from: null,
    to: null,
    yes: null,
    text: null,
}

/** Maps a parameter to its flat wire shape. */
const policyParameterWireOf = (value: PolicyValue): BrainPolicyParameterWire => {
    switch (value.type) {
        case "money":
            return { ...NONE, type: value.type, amountVnd: value.amountVnd, per: value.per }
        case "percent":
            return { ...NONE, type: value.type, percent: value.percent }
        case "duration":
            return { ...NONE, type: value.type, minutes: value.minutes }
        case "time_range":
            return { ...NONE, type: value.type, from: value.from, to: value.to }
        case "boolean":
            return { ...NONE, type: value.type, yes: value.yes }
        case "text":
            return { ...NONE, type: value.type, text: value.text }
    }
}

/** Maps a value. */
const valueWireOf = (view: PolicyValueView): BrainPolicyValueWire => ({
    ...view,
    audience: { ...view.audience, modules: [...view.audience.modules] },
    parameter: policyParameterWireOf(view.parameter),
})

/** Maps a proposal. */
const proposalWireOf = (view: PolicyProposalView): BrainPolicyProposalWire => ({
    ...valueWireOf(view),
    kind: view.kind,
    proposedBy: view.proposedBy,
    proposedAt: view.proposedAt,
    flags: [...view.flags],
    useAction: view.useAction,
})

/** Maps a row. */
const rowWireOf = (row: DerivedPolicyRow): BrainPolicyRowWire => ({
    ...row,
    current: row.current === null ? null : valueWireOf(row.current),
    scheduled: row.scheduled === null ? null : valueWireOf(row.scheduled),
    pendingValues: [...row.pendingValues],
})

/** Maps the tab to its wire shape. */
export const brainPoliciesWireOf = (policies: DerivedBrainPolicies): BrainPoliciesWire => ({
    groups: policies.groups.map((group) => ({ ...group, rows: group.rows.map((item) => rowWireOf(item)) })),
    pendingTotal: policies.pendingTotal,
    canEdit: policies.canEdit,
    missing: policies.missing.map((one) => ({ ...one })),
    derivation: { ...policies.derivation },
})

/** Maps the drawer to its wire shape; null when the row is not there. */
export const brainPolicyDetailWireOf = (detail: DerivedBrainPolicyDetail | null): BrainPolicyDetailWire | null =>
    detail === null
        ? null
        : {
              row: rowWireOf(detail.row),
              proposals: detail.proposals.map((item) => proposalWireOf(item)),
              history: detail.history.map((item) => valueWireOf(item)),
              canEdit: detail.canEdit,
          }
