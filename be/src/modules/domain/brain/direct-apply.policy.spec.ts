import { Test } from "@nestjs/testing"
import { arguesWith, overlays, passageHashOf, putInForceBy, settleVerdictOf } from "./direct-apply.policy"
import { builder } from "@starci/jest-preset"
import type { FactRecord } from "@modules/domain/brain-facts"
import { NO_CRITIQUE } from "./direct-apply.policy"
import type { OpenFinding } from "@modules/domain/dossier-review"
import type { PassageCritique, SettleContext } from "./direct-apply.policy"
import { CHI_LAN_VI, D_VI, PHI_SHIP_2_VI, PHI_SHIP_NOI_THANH_LA_30_VI, SHIP_NOI_THANH_VI, SO_TAY_VI, T_30_000_D_VI, T_50_000_D_VI, T_60_000_D_VI } from "@tests/fixtures/i18n/brain-a-spec.messages"
import { DELIVERY_SUBJECT_LABEL_VI } from "@tests/fixtures/i18n/brain-spec.messages"

const SUBJECT = Symbol("direct-apply.policy")
type Subject = typeof import("./direct-apply.policy")

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { arguesWith, overlays, passageHashOf, putInForceBy, settleVerdictOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const SOURCE = "22222222-2222-4222-8222-222222222222"
const HASH = "hash-ship"

const factOf = builder<FactRecord>({
    id: "f1",
    subjectType: "policy",
    subjectKey: "giao-hang-noi-thanh",
    subjectLabel: DELIVERY_SUBJECT_LABEL_VI,
    attribute: "phi-ship",
    attributeLabel: PHI_SHIP_2_VI,
    value: "30.000",
    valueNumber: 30_000,
    unit: D_VI,
    scope: "internal",
    modules: [],
    installationId: null,
    status: "proposed",
    sourceKind: "document",
    trust: 75,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [{ kind: "document", ref: SOURCE, label: SO_TAY_VI, quote: PHI_SHIP_NOI_THANH_LA_30_VI, sourceId: SOURCE, chunkHash: HASH }],
    proposedBy: SO_TAY_VI,
    proposedAt: "2026-11-11T03:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

const reviewed: PassageCritique = { state: "done", reviewed: new Set([HASH]), held: new Set(), confirmedBy: new Map() }

const contextOf = builder<SettleContext>({
    sourceId: SOURCE,
    memberDocument: true,
    critique: reviewed,
    rivals: 0,
    inForce: 0,
    sameAs: null,
})

const finding = (more: Partial<OpenFinding> = {}): OpenFinding => ({
    id: "p1",
    group: "other_document",
    kind: "other_document",
    severity: "high",
    holds: true,
    hashes: [HASH],
    factIds: ["f1"],
    namesAll: false,
    ...more,
})

describe("direct-apply.policy: the one gate of what goes in force by itself", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("puts a truth of a member's document in force when nothing contradicts it", () => {
        expect(subject.settleVerdictOf(factOf(), contextOf())).toBe("apply")
    })

    it("leaves every truth of a document no member stands behind waiting for a person, whatever else holds", () => {
        expect(subject.settleVerdictOf(factOf(), contextOf({ memberDocument: false }))).toBe("waiting")
    })

    it("asks the founder when the same key holds another value in force: his own edit stays, the document's line is the question", () => {
        expect(subject.settleVerdictOf(factOf({ conflictWith: "in-force" }), contextOf())).toBe("asked")
        // A value came in force for the key after the truth was filed (the founder edited meanwhile).
        expect(subject.settleVerdictOf(factOf(), contextOf({ inForce: 1 }))).toBe("asked")
    })

    it("asks when another value waits for the same key: two documents, or the document against itself", () => {
        expect(subject.settleVerdictOf(factOf(), contextOf({ rivals: 1 }))).toBe("asked")
    })

    it("asks when the same truth in other words holds another value, and closes it as a duplicate when the value is the same", () => {
        const flagged = factOf({ conflictWith: "other", flags: ["same_meaning"] })
        const other = factOf({ id: "other", subjectLabel: SHIP_NOI_THANH_VI, subjectKey: "ship-noi-thanh", status: "active" })

        expect(subject.settleVerdictOf(flagged, contextOf({ sameAs: { ...other, value: "35.000" } }))).toBe("asked")
        expect(subject.settleVerdictOf(flagged, contextOf({ sameAs: other }))).toBe("duplicate")
        // The truth it named is gone: nothing to compare with, the founder decides.
        expect(subject.settleVerdictOf(flagged, contextOf({ sameAs: null }))).toBe("asked")
    })

    it("no flag asks: a truth flagged stale or period_unclear applies; a proposal that retires a truth sets no value and is asked", () => {
        expect(subject.settleVerdictOf(factOf({ flags: ["stale"] }), contextOf())).toBe("apply")
        expect(subject.settleVerdictOf(factOf({ flags: ["period_unclear"] }), contextOf())).toBe("apply")
        expect(subject.settleVerdictOf(factOf({ proposalKind: "retire" }), contextOf())).toBe("asked")
    })

    it("asks when a holding point holds the passage (a contradiction, or text addressed to an AI)", () => {
        const held: PassageCritique = { ...reviewed, held: new Set([HASH]) }
        expect(subject.settleVerdictOf(factOf(), contextOf({ critique: held }))).toBe("asked")
    })

    it("never waits for the critic: a critique waiting, running, not done or absent, or a passage it never read, applies", () => {
        expect(subject.settleVerdictOf(factOf(), contextOf({ critique: NO_CRITIQUE }))).toBe("apply")
        expect(subject.settleVerdictOf(factOf(), contextOf({ critique: { ...reviewed, state: "waiting", reviewed: new Set() } }))).toBe("apply")
        expect(subject.settleVerdictOf(factOf(), contextOf({ critique: { ...reviewed, state: "running", reviewed: new Set() } }))).toBe("apply")
        expect(subject.settleVerdictOf(factOf(), contextOf({ critique: { ...reviewed, state: "not_done", reason: "credits", reviewed: new Set() } }))).toBe("apply")
        expect(subject.settleVerdictOf(factOf(), contextOf({ critique: { ...reviewed, reviewed: new Set(["another"]) } }))).toBe("apply")
    })

    it("a truth whose evidence names no passage of the document applies too", () => {
        const loose = factOf({ evidence: [{ kind: "document", ref: SOURCE, label: SO_TAY_VI, sourceId: SOURCE }] })
        expect(subject.passageHashOf(loose, SOURCE)).toBeNull()
        expect(subject.settleVerdictOf(loose, contextOf())).toBe("apply")
        // Evidence of ANOTHER document does not stand for this one.
        expect(subject.passageHashOf(factOf(), "another-document")).toBeNull()
    })
})

describe("direct-apply.policy: what the founder and the document's own points settle", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("the founder's answer settles ONLY the truth it names: kept as written = confirmed, typed = corrected; the passage's other truths go in at the document's trust", () => {
        const answered: PassageCritique = { ...reviewed, decided: new Map([["f1", { kind: "confirmed", by: CHI_LAN_VI }]]) }
        expect(subject.settleVerdictOf(factOf(), contextOf({ critique: answered }))).toBe("confirmed")
        expect(subject.settleVerdictOf(factOf({ id: "f2" }), contextOf({ critique: answered }))).toBe("apply")
        // The question he answered was the contradiction: his answer goes in force over the value in force and over a waiting rival.
        expect(subject.settleVerdictOf(factOf({ conflictWith: "in-force" }), contextOf({ critique: answered, inForce: 1, rivals: 1 }))).toBe("confirmed")
        const typed: PassageCritique = { ...reviewed, decided: new Map([["own", { kind: "corrected", by: CHI_LAN_VI }]]) }
        // His typed value is his own truth: it names no passage of the document, so it waits for no review.
        expect(subject.settleVerdictOf(factOf({ id: "own", sourceKind: "owner", evidence: [] }), contextOf({ critique: typed }))).toBe("corrected")
    })

    it("an answered truth still waits when another open holding point names it or its value is not of the truth's type; an unread passage does not hold it", () => {
        const decided = new Map([["f1", { kind: "confirmed" as const, by: CHI_LAN_VI }]])
        expect(subject.settleVerdictOf(factOf(), contextOf({ critique: { ...reviewed, decided, findings: [finding()] } }))).toBe("asked")
        expect(subject.settleVerdictOf(factOf(), contextOf({ critique: { ...reviewed, decided, findings: [finding({ holds: false })] } }))).toBe("confirmed")
        expect(subject.settleVerdictOf(factOf(), contextOf({ critique: { ...reviewed, decided }, typeProblem: true }))).toBe("asked")
        expect(subject.settleVerdictOf(factOf(), contextOf({ critique: { ...reviewed, decided, reviewed: new Set() } }))).toBe("confirmed")
    })

    it("a truth an open holding point names waits tied to that point, even when the point quotes another passage; an old point of a removed kind holds nothing", () => {
        const elsewhere: PassageCritique = { ...reviewed, findings: [finding({ hashes: ["other-passage"] })] }
        expect(subject.settleVerdictOf(factOf(), contextOf({ critique: elsewhere }))).toBe("asked")
        for (const kind of ["vague", "hearsay", "stale", "typo"]) {
            const old: PassageCritique = { ...reviewed, findings: [finding({ kind, group: kind, holds: false })] }
            expect(subject.settleVerdictOf(factOf(), contextOf({ critique: old }))).toBe("apply")
        }
    })

    it("a truth another waiting truth of the same document disagrees with in other words is asked about, never put in force", () => {
        expect(subject.settleVerdictOf(factOf(), contextOf({ contested: true }))).toBe("asked")
    })

    it("arguesWith: a stated window over an open-ended value is an overlay; two windows argue only when they overlap; an open-ended other value argues", () => {
        const standing = factOf({ id: "s", value: "30.000" })
        const tet = factOf({ id: "w", value: "50.000", validFrom: "2027-01-31T17:00:00.000Z", validTo: "2027-02-05T17:00:00.000Z" })
        const overlapping = factOf({ id: "w2", value: "60.000", validFrom: "2027-02-03T17:00:00.000Z", validTo: "2027-02-10T17:00:00.000Z" })
        const apart = factOf({ id: "w3", value: "60.000", validFrom: "2027-04-29T17:00:00.000Z", validTo: "2027-05-01T17:00:00.000Z" })
        const untilOnly = factOf({ id: "w4", value: "10 %", validTo: "2026-11-30T17:00:00.000Z" })
        expect([subject.arguesWith(tet, standing, true), subject.arguesWith(tet, standing, false), subject.arguesWith(untilOnly, standing, true)]).toEqual([false, false, false])
        expect([subject.arguesWith(tet, overlapping, true), subject.arguesWith(tet, apart, true)]).toEqual([true, false])
        // An open-ended other value: against anything in force, and against an open-ended value that waits; not against a waiting window.
        const other = factOf({ id: "o", value: "35.000" })
        expect([subject.arguesWith(other, standing, true), subject.arguesWith(other, standing, false), subject.arguesWith(other, tet, true), subject.arguesWith(other, tet, false)]).toEqual([true, true, true, false])
        // The same value never argues, however written.
        expect(subject.arguesWith(factOf({ value: "30k", unit: null }), factOf({ value: T_30_000_D_VI, unit: null }), true)).toBe(false)
    })

    it("putInForceBy: the value in force is this document's own only when a settle of THIS document put it there and nobody changed it since", () => {
        const own = factOf({ status: "active", decisionNote: `direct:${SOURCE} - In force from the founder's own document` })
        expect(subject.putInForceBy(own, SOURCE)).toBe(true)
        expect(subject.putInForceBy({ ...own, decisionNote: `updated:${SOURCE} - updated` }, SOURCE)).toBe(true)
        expect(subject.putInForceBy({ ...own, decisionNote: `confirmed:${SOURCE} - confirmed` }, SOURCE)).toBe(true)
        expect(subject.putInForceBy(own, "another-document")).toBe(false)
        expect(subject.putInForceBy({ ...own, sourceKind: "owner" }, SOURCE)).toBe(false)
        expect(subject.putInForceBy({ ...own, decisionNote: null }, SOURCE)).toBe(false)
    })

    it("a document that updates its own value is the next version; a truth named on its own key follows the key's rules, not the name", () => {
        expect(subject.settleVerdictOf(factOf({ conflictWith: "own" }), contextOf({ conflictOnKey: true, updates: true }))).toBe("updated")
        expect(subject.settleVerdictOf(factOf({ conflictWith: "own" }), contextOf({ conflictOnKey: true }))).toBe("apply")
        // The founder's edit (a value in force that is not this document's) still asks.
        expect(subject.settleVerdictOf(factOf({ conflictWith: "edit" }), contextOf({ conflictOnKey: true, inForce: 1 }))).toBe("asked")
    })

    it("a passage whose points are all answered no longer confirms its other truths: they go in force at the document's trust", () => {
        const answeredPassage: PassageCritique = { ...reviewed, confirmedBy: new Map([[HASH, CHI_LAN_VI]]) }
        expect(subject.settleVerdictOf(factOf(), contextOf({ critique: answeredPassage }))).toBe("apply")
    })
})

describe("direct-apply.policy: a window over a standing value is its overlay, never a question (D-N-5, TW-HOL / TW-END)", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    // P02 on dev: a sentence stating that from 01/02/2027 to the end of 05/02/2027 the inner-city delivery fee from branch 1 is 50,000 dong.
    const tet = factOf({
        id: "tet",
        subjectKey: "phi-giao-hang-noi-thanh-tu-chi-nhanh-1-dip-tet",
        value: T_50_000_D_VI,
        valueNumber: 50_000,
        validFrom: "2027-01-31T17:00:00.000Z",
        validTo: "2027-02-05T17:00:00.000Z",
        conflictWith: "standing",
        flags: ["same_meaning"],
    })
    const standing = factOf({ id: "standing", status: "active", validFrom: "2026-11-11T14:07:23.495Z", validTo: "2027-11-11T14:07:23.495Z" })

    it("treats a truth in force with the DEFAULT one-year end (owner 2026-11-10) as standing, a stated end as a window", () => {
        expect(subject.overlays(tet, standing)).toBe(true)
        expect(subject.overlays(tet, factOf({ validTo: null }))).toBe(true)
        expect(subject.overlays(tet, factOf({ validFrom: "2026-11-11T00:00:00.000Z", validTo: "2027-03-01T00:00:00.000Z" }))).toBe(false)
        expect(subject.overlays(standing, tet)).toBe(false)
    })

    it("lets the window the same-meaning judge linked to the standing value go in force (was: asked, conflictWith first)", () => {
        expect(subject.settleVerdictOf(tet, contextOf({ sameAs: standing }))).toBe("apply")
    })

    it("still asks when the linked value is another window, and closes a same-value match as a duplicate", () => {
        const other = factOf({ id: "standing", value: T_60_000_D_VI, validFrom: tet.validFrom, validTo: tet.validTo })
        expect(subject.settleVerdictOf(tet, contextOf({ sameAs: other }))).toBe("asked")
        expect(subject.settleVerdictOf(tet, contextOf({ sameAs: { ...standing, value: T_50_000_D_VI } }))).toBe("duplicate")
    })

    it("a window over a value in force of its own key with the default end does not argue with it (the overlay of D-BR-18)", () => {
        expect(subject.arguesWith(tet, standing, true)).toBe(false)
    })
})

describe("direct-apply.policy: a stated window is never a date question (D2)", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("a window whose year the document never wrote, or one already over, applies: the store files an ended one as history", () => {
        expect(subject.settleVerdictOf(factOf({ validFrom: "2027-10-17T17:00:00.000Z", validTo: "2027-10-20T17:00:00.000Z" }), contextOf())).toBe("apply")
        expect(subject.settleVerdictOf(factOf({ validFrom: "2025-10-17T17:00:00.000Z", validTo: "2025-10-20T17:00:00.000Z" }), contextOf())).toBe("apply")
    })
})

describe("direct-apply.policy: a document updates only a value it alone stands behind (TRIAGE-4)", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("is its own update while the value in force has no other document's evidence; asked once another source joined it", () => {
        const own = factOf({ status: "active", decisionNote: `direct:${SOURCE} - In force` })
        expect(subject.putInForceBy(own, SOURCE)).toBe(true)
        const joined = factOf({
            status: "active",
            decisionNote: `direct:${SOURCE} - In force`,
            evidence: [...own.evidence, { kind: "document", ref: "other", label: "Other", sourceId: "other", chunkHash: "h2" }],
        })
        expect(subject.putInForceBy(joined, SOURCE)).toBe(false)
    })
})
