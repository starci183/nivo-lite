import { Test } from "@nestjs/testing"
import { LeadActionsErrorCode } from "./errors/lead-actions.error"
import { ownerProposalOf as ownerProposalOfImplementation } from "./lead-owner-proposal.policy"

const SUBJECT = Symbol("subject")
type Subject = { ownerProposalOf: typeof ownerProposalOfImplementation }
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { ownerProposalOf: ownerProposalOfImplementation } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const proposal = {
    title: " Call prospect ",
    owner_kind: "agent",
    owner_handle: " sales-agent ",
    next_action: " Prepare a quote ",
    due_in_days: 2,
    rationale: " They asked for pricing ",
}
const invalid = (field: string) => ({
    kind: "refused",
    code: LeadActionsErrorCode.InvalidInput,
    params: { field },
})

describe("lead owner proposal policy", () => {
    it.each([undefined, null, 42, "proposal", []])("refuses a non-record proposal %p", async (value) => {
        const subject = await buildSubject()

        expect(subject.ownerProposalOf(value)).toEqual(invalid("proposal"))
    })

    it("trims an agent proposal and drops unrelated properties", async () => {
        const subject = await buildSubject()

        expect(subject.ownerProposalOf({ ...proposal, extra: "ignored" })).toEqual({
            kind: "ok",
            value: {
                title: "Call prospect",
                owner_kind: "agent",
                owner_handle: "sales-agent",
                next_action: "Prepare a quote",
                due_in_days: 2,
                rationale: "They asked for pricing",
            },
        })
    })

    it.each([null, "", " named-person "])("clears a human owner's handle %p", async (handle) => {
        const subject = await buildSubject()

        expect(
            subject.ownerProposalOf({ ...proposal, owner_kind: "human", owner_handle: handle, rationale: " " }),
        ).toEqual({
            kind: "ok",
            value: {
                title: "Call prospect",
                owner_kind: "human",
                owner_handle: null,
                next_action: "Prepare a quote",
                due_in_days: 2,
                rationale: "",
            },
        })
    })

    it.each<readonly [string, unknown]>([
        ["title", 42],
        ["title", " "],
        ["title", "t".repeat(201)],
        ["next_action", ""],
        ["next_action", "a".repeat(1001)],
        ["rationale", undefined],
        ["rationale", "r".repeat(2001)],
        ["owner_kind", "unknown"],
        ["owner_handle", undefined],
        ["owner_handle", "h".repeat(65)],
        ["owner_handle", null],
        ["owner_handle", " "],
        ["due_in_days", "2"],
        ["due_in_days", Number.NaN],
        ["due_in_days", Number.POSITIVE_INFINITY],
        ["due_in_days", -1],
        ["due_in_days", 366],
    ])("refuses invalid %s value %p", async (field, value) => {
        const subject = await buildSubject()

        expect(subject.ownerProposalOf({ ...proposal, [field]: value })).toEqual(invalid(field))
    })

    it.each([0, 365])("accepts a proposal at the due-day boundary %s", async (dueDays) => {
        const subject = await buildSubject()

        const value = {
            title: "t".repeat(200),
            owner_kind: "agent",
            owner_handle: "h".repeat(64),
            next_action: "a".repeat(1000),
            due_in_days: dueDays,
            rationale: "r".repeat(2000),
        }
        expect(subject.ownerProposalOf(value)).toEqual({ kind: "ok", value })
    })
})
