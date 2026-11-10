import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { FactRecord } from "@modules/domain/brain-facts"
import { originOf as realOriginOf, subjectPageOf as realSubjectPageOf } from "./brain-graph.policy"

const DOC = "doc-ship"

const factOf = builder<FactRecord>({
    id: "f1",
    subjectType: "policy",
    subjectKey: "giao-hang",
    subjectLabel: "Giao hang",
    attribute: "phi-ship-noi-thanh",
    attributeLabel: "Phi ship noi thanh",
    value: "30.000 d",
    valueNumber: 30000,
    unit: null,
    scope: "internal",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 95,
    validFrom: "2026-11-10T00:00:00.000Z",
    validTo: "2027-11-10T00:00:00.000Z",
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "Ada",
    proposedAt: "2026-11-10T00:00:00.000Z",
    decidedBy: "Ada",
    decidedAt: "2026-11-10T00:00:00.000Z",
    decisionNote: null,
})

const docEvidence = { kind: "document" as const, ref: DOC, label: "Quy dinh giao hang.docx", title: "Quy dinh giao hang.docx", sourceId: DOC, chunkHash: "h-ship", quote: "Phi ship 30.000" }

const ship = factOf({ id: "ship", version: 3, supersedesId: "ship-v2", evidence: [docEvidence] })
const hours = factOf({ id: "hours", subjectKey: "gio-lam-viec", subjectLabel: "Gio lam viec", attribute: "mo-cua", attributeLabel: "Mo cua", value: "8:00-20:00", decidedAt: "2026-11-01T00:00:00.000Z" })
const proposalEvidence = [{ kind: "message" as const, ref: "team-chat:m1", label: "Private chat with an agent", quote: "them phu phi 15k sau 18h" }]


const SUBJECT = Symbol("brain-graph.policy")



describe("brain-graph.policy as a Nest value", () => {
    let originOf: typeof realOriginOf
    let subjectPageOf: typeof realSubjectPageOf

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: { originOf: realOriginOf, subjectPageOf: realSubjectPageOf } }],
        }).compile()
        const subject = moduleRef.get<{ originOf: typeof realOriginOf; subjectPageOf: typeof realSubjectPageOf }>(SUBJECT)
        originOf = subject.originOf
        subjectPageOf = subject.subjectPageOf
    })

    describe("brain-graph.policy", () => {
        it("pages subjects in key order after the cursor and names the next cursor", () => {
            const all = [ship, hours, factOf({ id: "z", subjectKey: "zz" })]

            expect(subjectPageOf(all, { limit: 1 })).toEqual({ subjects: ["giao-hang"], nextCursor: "giao-hang" })
            expect(subjectPageOf(all, { limit: 1, cursor: "giao-hang" })).toEqual({ subjects: ["gio-lam-viec"], nextCursor: "gio-lam-viec" })
            expect(subjectPageOf(all, { limit: 5, cursor: "gio-lam-viec" })).toEqual({ subjects: ["zz"], nextCursor: null })
            expect(subjectPageOf(all, { query: "mo cua" })).toEqual({ subjects: ["gio-lam-viec"], nextCursor: null })
        })

        it("names the origin of a truth: a document passage, a chat message, a person, or other", () => {
            expect(originOf([docEvidence])).toEqual({
                kind: "document",
                label: "Quy dinh giao hang.docx",
                quote: "Phi ship 30.000",
                sourceId: DOC,
                chunkHash: "h-ship",
                messageId: null,
            })
            expect(originOf(proposalEvidence)).toMatchObject({ kind: "chat", messageId: "m1", quote: "them phu phi 15k sau 18h" })
            expect(originOf([])).toMatchObject({ kind: "other", label: "" })
        })
    })
})
