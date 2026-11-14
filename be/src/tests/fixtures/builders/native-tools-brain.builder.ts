import type { FactRecord } from "@modules/domain/brain-facts"
import type { Passage } from "@modules/domain/knowledge"
import type { SourceDocument } from "@modules/domain/knowledge-sources"
import {
    DELIVERY_POLICY_FILE_VI,
    DELIVERY_SUBJECT_LABEL_VI,
    DONG_UNIT_VI,
    INNER_CITY_FEE_LABEL_VI,
    POLICY_LABEL_VI,
} from "@tests/fixtures/i18n/native-tools-spec.messages"

/** One public truth of the shop, with the given fields changed. */
export const brainFactOf = (changes: Partial<FactRecord> = {}): FactRecord => ({
    id: "f1",
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "hours",
    attributeLabel: "Hours",
    value: "8 to 21",
    valueNumber: null,
    unit: null,
    scope: "public",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 95,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [{ kind: "document", ref: "https://x", label: "Price list", quote: "private words", connectionId: "c9" }],
    proposedBy: "u1",
    proposedAt: "2026-10-01T00:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    ...changes,
})

/** One passage of the shop's knowledge, with the given fields changed. */
export const brainPassageOf = (changes: Partial<Passage> = {}): Passage => ({
    layer: "business",
    id: "p1",
    sourceId: "s1",
    module: null,
    kind: "faq",
    title: "Hours",
    content: "Open 8 to 21",
    score: 0.9,
    visibility: "public",
    topic: "hours",
    order: 2,
    ...changes,
})

/** One knowledge document of the shop, with the given fields changed. */
export const brainDocumentOf = (changes: Partial<SourceDocument> = {}): SourceDocument => ({
    id: "d1",
    title: "Delivery policy",
    visibility: "internal",
    status: "ready",
    contentHash: "h1",
    module: null,
    installationId: null,
    topic: "delivery",
    content: "Same day delivery. Call 0901234567 when needed.",
    ...changes,
})

/** An internal truth in force (version 2) with its source document, validity and unit. */
export const FEE_TRUTH: FactRecord = brainFactOf({
    id: "fee",
    subjectKey: "giao-hang",
    attribute: "phi-ship-noi-thanh",
    subjectLabel: DELIVERY_SUBJECT_LABEL_VI,
    attributeLabel: INNER_CITY_FEE_LABEL_VI,
    value: "30.000",
    unit: DONG_UNIT_VI,
    scope: "internal",
    version: 2,
    validFrom: "2026-10-10T17:00:00.000Z",
    validTo: "2027-10-10T17:00:00.000Z",
    evidence: [{ kind: "document", ref: "doc-1", label: POLICY_LABEL_VI, title: DELIVERY_POLICY_FILE_VI, at: "2026-10-09T08:00:00.000Z" }],
})
/** A rival value of the same truth, said by staff in the team chat. */
export const RIVAL_TRUTH: FactRecord = brainFactOf({
    ...FEE_TRUTH,
    id: "rival",
    value: "20.000",
    scope: "internal",
    version: 1,
    sourceKind: "staff",
    evidence: [{ kind: "message", ref: "team-chat:m1", label: "Common chat", at: "2026-10-20T03:00:00.000Z" }],
})
const { version: _version, ...unnumbered } = FEE_TRUTH
/** A value waiting for the founder's decision, said in a private chat. */
export const WAITING_TRUTH: FactRecord = brainFactOf({
    ...unnumbered,
    id: "waiting",
    status: "proposed",
    value: "35.000",
    sourceKind: "owner",
    evidence: [{ kind: "message", ref: "team-chat:m2", label: "Private chat with an agent", at: "2026-10-30T02:00:00.000Z" }],
})
/** A value scheduled to take over from the first of December. */
export const LATER_TRUTH: FactRecord = brainFactOf({ ...FEE_TRUTH, id: "later", status: "scheduled", value: "32.000", validFrom: "2026-12-01T00:00:00.000Z" })
