import { Test } from "@nestjs/testing"
import type { BrainFactRow } from "./persistence/brain-facts.rows"
import { isoOf, toFactRecord } from "./fact-record.mapper"
const SUBJECT = Symbol("fact-record.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isoOf, toFactRecord } }],
    }).compile()
    return moduleRef.get<typeof import("./fact-record.mapper")>(SUBJECT)
}

const row = (overrides: Partial<BrainFactRow> = {}): BrainFactRow => ({
    id: "f1",
    workspace_id: "w1",
    subject_type: "product",
    subject_key: "combo",
    subject_label: "Combo",
    attribute: "price",
    attribute_label: "Price",
    value: "650000 VND",
    value_number: "650000",
    unit: "VND",
    scope: "restricted",
    modules: ["chatbot"],
    installation_id: "i1",
    status: "active",
    source_kind: "owner",
    trust: 95,
    valid_from: new Date("2026-01-01T00:00:00.000Z"),
    valid_to: "2027-01-01T00:00:00.000Z",
    supersedes_id: "f0",
    conflict_with: "f2",
    proposal_kind: "retire",
    evidence: [{ kind: "manual", ref: "m1", label: "Owner" }],
    proposed_by: "u1",
    proposed_at: new Date("2025-12-01T00:00:00.000Z"),
    decided_by: "u2",
    decided_at: "2025-12-02T00:00:00.000Z",
    decision_note: "Approved",
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
            value: "650000 VND",
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
                    value_number: null,
                    unit: null,
                    modules: null,
                    installation_id: null,
                    valid_from: null,
                    valid_to: null,
                    supersedes_id: null,
                    conflict_with: null,
                    proposal_kind: null,
                    evidence: null,
                    proposed_at: "2025-12-01T00:00:00.000Z",
                    decided_by: null,
                    decided_at: null,
                    decision_note: null,
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
