import { Test } from "@nestjs/testing"
import { isoOf, toFactRecord } from "./fact-record.mapper"
import * as facts from "@tests/fixtures/builders/brain-facts.builder"
import type { StoredFact } from "./fact-record.mapper"
import {
    DONG_VI,
    PRICE_12K_TIGHT_VI,
    PRICE_30K_PER_ORDER_VI,
    PRICE_30K_TIGHT_VI,
    PRICE_32K_PER_ORDER_VI,
    UNIT_STEM_VI,
} from "@tests/fixtures/i18n/brain-facts-spec.messages"
const SUBJECT = Symbol("fact-record.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isoOf, toFactRecord } }],
    }).compile()
    return moduleRef.get<typeof import("./fact-record.mapper")>(SUBJECT)
}

const row = (overrides: Partial<StoredFact> = {}): StoredFact => ({
    id: "f1",
    subjectType: "product",
    subjectKey: "combo",
    subjectLabel: "Combo",
    attribute: "price",
    attributeLabel: "Price",
    value: "650000 VND",
    valueNumber: "650000",
    unit: "VND",
    scope: "restricted",
    modules: ["chatbot"],
    installationId: "i1",
    status: "active",
    sourceKind: "owner",
    trust: 95,
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
    validTo: "2027-01-01T00:00:00.000Z",
    supersedesId: "f0",
    conflictWith: "f2",
    proposalKind: "retire",
    evidence: [{ kind: "manual", ref: "m1", label: "Owner" }],
    proposedBy: "u1",
    proposedAt: new Date("2025-12-01T00:00:00.000Z"),
    decidedBy: "u2",
    decidedAt: "2025-12-02T00:00:00.000Z",
    decisionNote: "Approved",
    ...overrides,
})

describe("fact records", () => {
    it("formats a driver Date or preserves existing timestamp text", async () => {
        const subject = await build()

        expect(subject.isoOf(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01T00:00:00.000Z")
        expect(subject.isoOf("2026-01-02T00:00:00.000Z")).toBe("2026-01-02T00:00:00.000Z")
    })

    it("maps all stored fields with numeric conversion and timestamp normalization", async () => {
        const subject = await build()

        expect(subject.toFactRecord(row())).toEqual({
            id: "f1",
            subjectType: "product",
            subjectKey: "combo",
            subjectLabel: "Combo",
            attribute: "price",
            attributeLabel: "Price",
            // The stored value also said its unit: it reads in the one normal form, the unit kept apart once.
            value: "650000",
            valueNumber: 650000,
            unit: "VND",
            scope: "restricted",
            modules: ["chatbot"],
            installationId: "i1",
            status: "active",
            sourceKind: "owner",
            trust: 95,
            validFrom: "2026-01-01T00:00:00.000Z",
            validTo: "2027-01-01T00:00:00.000Z",
            supersedesId: "f0",
            conflictWith: "f2",
            proposalKind: "retire",
            evidence: [{ kind: "manual", ref: "m1", label: "Owner" }],
            proposedBy: "u1",
            proposedAt: "2025-12-01T00:00:00.000Z",
            decidedBy: "u2",
            decidedAt: "2025-12-02T00:00:00.000Z",
            decisionNote: "Approved",
        })
    })
})

describe("fact records", () => {
    it("preserves null values and supplies defaults for optional stored collections and proposal kind", async () => {
        const subject = await build()

        expect(
            subject.toFactRecord(
                row({
                    valueNumber: null,
                    unit: null,
                    modules: null,
                    installationId: null,
                    validFrom: null,
                    validTo: null,
                    supersedesId: null,
                    conflictWith: null,
                    proposalKind: null,
                    evidence: null,
                    proposedAt: "2025-12-01T00:00:00.000Z",
                    decidedBy: null,
                    decidedAt: null,
                    decisionNote: null,
                }),
            ),
        ).toEqual({
            id: "f1",
            subjectType: "product",
            subjectKey: "combo",
            subjectLabel: "Combo",
            attribute: "price",
            attributeLabel: "Price",
            value: "650000 VND",
            valueNumber: null,
            unit: null,
            scope: "restricted",
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
            evidence: [],
            proposedBy: "u1",
            proposedAt: "2025-12-01T00:00:00.000Z",
            decidedBy: null,
            decidedAt: null,
            decisionNote: null,
        })
    })
})

describe("fact-record.mapper review flags (BG2)", () => {
    it("reads the flags only when there are some", () => {
        expect(toFactRecord({ ...facts.rowOf(), reviewFlags: ["stale"] }).flags).toEqual(["stale"])
        expect(toFactRecord({ ...facts.rowOf(), reviewFlags: [] })).not.toHaveProperty("flags")
        expect(toFactRecord({ ...facts.rowOf(), reviewFlags: null })).not.toHaveProperty("flags")
        expect(toFactRecord(facts.rowOf())).toEqual(facts.factOf())
    })
})

describe("fact records: value and unit in the one normal form (D-T5-1)", () => {
    it("a row stored with the unit inside its value AND apart reads with the unit once (the live 0415ae99 proposal)", async () => {
        const subject = await build()

        expect(subject.toFactRecord(row({ value: PRICE_32K_PER_ORDER_VI, unit: DONG_VI }))).toMatchObject({
            value: PRICE_32K_PER_ORDER_VI,
            unit: null,
        })
        expect(subject.toFactRecord(row({ value: PRICE_30K_TIGHT_VI, unit: DONG_VI }))).toMatchObject({
            value: "30.000",
            unit: DONG_VI,
        })
    })

    it("a row already in the normal form reads as stored", async () => {
        const subject = await build()

        expect(subject.toFactRecord(row({ value: PRICE_12K_TIGHT_VI, unit: UNIT_STEM_VI }))).toMatchObject({
            value: PRICE_12K_TIGHT_VI,
            unit: UNIT_STEM_VI,
        })
        expect(subject.toFactRecord(row({ value: PRICE_30K_PER_ORDER_VI, unit: null }))).toMatchObject({
            value: PRICE_30K_PER_ORDER_VI,
            unit: null,
        })
    })
})
