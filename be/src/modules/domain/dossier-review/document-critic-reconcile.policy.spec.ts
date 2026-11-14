import { Test } from "@nestjs/testing"
import type { CriticPoint } from "./document-critic.contracts"
import { HOLDING_SEVERITIES, heldHashes, holdingPoint, reconcileCritique } from "./document-critic-reconcile.policy"
import { DossierFindingEntity } from "./persistence/entities"

const SUBJECT = Symbol("document-critic-reconcile.policy")
type Subject = { heldHashes: typeof heldHashes; holdingPoint: typeof holdingPoint; reconcileCritique: typeof reconcileCritique }
const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({ providers: [{ provide: SUBJECT, useValue: { heldHashes, holdingPoint, reconcileCritique } }] }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const NOW = new Date("2026-11-12T08:00:00.000Z")

/** A stored critic point quoting one passage of this document (claim) and one of another document (counter). */
const pointOf = (hash: string, severity: string, status = "open", kind = "shop_contradiction", origin = "rule", params: Readonly<Record<string, string>> = {}): DossierFindingEntity =>
    Object.assign(new DossierFindingEntity(), {
        id: `p-${hash}-${kind}-${origin}`,
        fingerprint: `fp-${hash}-${kind}-${origin}`,
        ruleKey: `shop.${kind}`,
        origin,
        severity,
        status,
        resolution: null,
        params: { sourceId: "doc", shopKind: kind, ...params },
        evidence: [
            { role: "claim", chunkHash: hash },
            { role: "counter", chunkHash: `other-${hash}` },
        ],
    })

describe("heldHashes: the passages an open HOLDING point holds back from customers", () => {
    it("holds the passages of open contradiction points and of the model's text addressed to an AI, high or medium; never of a low one", async () => {
        const subject = await buildSubject()

        const held = subject.heldHashes([
            pointOf("fee", "high"),
            pointOf("branch", "medium", "open", "other_document"),
            pointOf("planted", "high", "confirmed", "addressed_to_ai", "ai"),
            pointOf("low", "low", "open", "inside_contradiction"),
        ])

        expect([...held].sort((a, b) => a.localeCompare(b))).toEqual(["branch", "fee", "planted"])
        expect([...HOLDING_SEVERITIES].sort((a, b) => a.localeCompare(b))).toEqual(["critical", "high", "medium"])
    })

    it("D5: an open point of a removed kind, an old verdict, a contradiction the old model read and a rule-raised AI flag hold nothing", async () => {
        const subject = await buildSubject()
        const old = [
            pointOf("typo", "high", "open", "typo"),
            pointOf("vague", "medium", "open", "vague", "ai"),
            pointOf("template", "medium", "open", "template"),
            pointOf("stale", "high", "open", "stale_date", "ai"),
            pointOf("verdict", "high", "open", "shop_contradiction", "ai", { verdictOf: "f1" }),
            pointOf("model-shop", "high", "open", "shop_contradiction", "ai"),
            pointOf("rule-ai", "high", "open", "addressed_to_ai", "rule"),
        ]

        expect(subject.heldHashes(old).size).toBe(0)
        expect(old.map((row) => subject.holdingPoint(row))).toEqual(old.map(() => false))
    })

    it("lets a passage through once its point is answered, skipped or gone, and never holds the other document's quote", async () => {
        const subject = await buildSubject()

        expect(subject.heldHashes([pointOf("rush", "medium", "resolved"), pointOf("fee", "high", "dismissed")]).size).toBe(0)
        expect(subject.heldHashes([pointOf("fee", "high")]).has("other-fee")).toBe(false)
    })
})

describe("reconcileCritique: old points of removed kinds close at the document's next critique (D5)", () => {
    it("every open point of a removed kind is closed `not_detected`, whoever raised it and whether or not the model read its passage again; a produced model flag on a passage not read again stays", async () => {
        const subject = await buildSubject()
        const stored = [
            pointOf("vague", "medium", "open", "vague", "ai"),
            pointOf("verdict", "high", "open", "shop_contradiction", "ai", { verdictOf: "f1" }),
            pointOf("template", "medium", "open", "template"),
            pointOf("planted", "high", "open", "addressed_to_ai", "ai"),
            pointOf("answered", "high", "resolved", "typo"),
        ]

        const out = subject.reconcileCritique(
            { sourceId: "doc", stored, found: [], present: new Set(["vague", "verdict", "template", "planted", "answered"]), reread: new Set() },
            NOW,
        )

        expect(out.inserts).toEqual([])
        expect(out.changes.map((change) => [change.id, change.changes.status, change.changes.resolution])).toEqual([
            ["p-vague-vague-ai", "resolved", "not_detected"],
            ["p-verdict-shop_contradiction-ai", "resolved", "not_detected"],
            ["p-template-template-rule", "resolved", "not_detected"],
        ])
    })

    it("a contradiction found again is refreshed and keeps its row", async () => {
        const subject = await buildSubject()
        const row = pointOf("fee", "high")
        const point: CriticPoint = {
            kind: "shop_contradiction",
            origin: "rule",
            severity: "high",
            subject: "shirt|price",
            line: "line",
            why: "why",
            question: "question",
            quotes: [{ text: "Shirt: 25,000 VND", passageId: "c1", chunkHash: "fee", role: "this", factId: "f1", sourceId: "doc", sourceTitle: "Prices" }],
            against: null,
            choices: [],
        }

        const out = subject.reconcileCritique({ sourceId: "doc", stored: [row], found: [{ point, fingerprint: row.fingerprint }], present: new Set(["fee"]), reread: new Set() }, NOW)

        expect(out.inserts).toEqual([])
        expect(out.changes.map((change) => [change.id, change.changes.lastSeenAt])).toEqual([[row.id, NOW]])
    })
})
