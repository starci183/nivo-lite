import {
    ADDRESS_LABEL_VI,
    ADDRESS_VALUE_VI,
    DELIVERY_FEE_LABEL_VI,
    DELIVERY_FEE_VALUE_VI,
    DELIVERY_GROUP_LABEL_VI,
    DELIVERY_SUBJECT_LABEL_VI,
    OPENING_HOURS_LABEL_VI,
    OPENING_HOURS_VALUE_VI,
    OWNER_CAN_CHANGE_REASON_VI,
    SHOP_LABEL_VI,
} from "@tests/fixtures/i18n/brain-spec.messages"
import type { FactRecord } from "@modules/domain/brain-facts"
import { basisOf, groupKeyOf, valueTypeOf, type DerivedPolicy } from "@modules/domain/brain/policy-derive.policy"

/** Fixtures of the derived policy layer's specs: a small shop's truths and the judgements made of them. */

/** The instant the specs read the facts at. */
export const DERIVE_NOW = "2026-11-11T10:00:00.000Z"

/** A fact in force with the given fields. */
export const deriveFactOf = (fields: Partial<FactRecord> & Pick<FactRecord, "id">): FactRecord => ({
    subjectType: "service",
    subjectKey: "giao-hang-noi-thanh",
    subjectLabel: DELIVERY_SUBJECT_LABEL_VI,
    attribute: "phi-giao-hang",
    attributeLabel: DELIVERY_FEE_LABEL_VI,
    value: DELIVERY_FEE_VALUE_VI,
    valueNumber: 30000,
    unit: null,
    scope: "internal",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "document",
    trust: 75,
    validFrom: "2026-11-10T00:00:00.000Z",
    validTo: "2027-11-10T00:00:00.000Z",
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "NIVO",
    proposedAt: "2026-11-10T00:00:00.000Z",
    decidedBy: "Ada",
    decidedAt: "2026-11-10T00:00:00.000Z",
    decisionNote: null,
    version: 1,
    ...fields,
})

/** The delivery fee: a rule. */
export const FEE: FactRecord = deriveFactOf({ id: "fee" })

/** The opening hours: a rule. */
export const HOURS: FactRecord = deriveFactOf({
    id: "hours",
    subjectType: "business",
    subjectKey: "tiem",
    subjectLabel: SHOP_LABEL_VI,
    attribute: "gio-mo-cua",
    attributeLabel: OPENING_HOURS_LABEL_VI,
    value: OPENING_HOURS_VALUE_VI,
    valueNumber: null,
})

/** The address: identity data, not a rule. */
export const ADDRESS: FactRecord = deriveFactOf({
    id: "address",
    subjectType: "business",
    subjectKey: "tiem",
    subjectLabel: SHOP_LABEL_VI,
    attribute: "dia-chi",
    attributeLabel: ADDRESS_LABEL_VI,
    value: ADDRESS_VALUE_VI,
    valueNumber: null,
})

/** The judgement of a fact as the store keeps it. */
export const derivedOf = (
    fact: FactRecord,
    fields: Partial<DerivedPolicy> & { readonly title?: string; readonly group?: string } = {},
): DerivedPolicy => {
    const { group, ...rest } = fields
    const kind = rest.kind ?? "policy"
    const label = kind === "policy" ? (group ?? DELIVERY_GROUP_LABEL_VI) : ""
    return {
        id: `p-${fact.id}`,
        subjectKey: fact.subjectKey,
        attribute: fact.attribute,
        installationId: fact.installationId,
        factId: fact.id,
        factVersion: fact.version ?? null,
        basis: basisOf(fact),
        kind,
        title: kind === "policy" ? fact.attributeLabel : "",
        groupKey: groupKeyOf(label),
        groupLabel: label,
        valueType: valueTypeOf(fact),
        reason: OWNER_CAN_CHANGE_REASON_VI,
        status: "open",
        ...rest,
    }
}
