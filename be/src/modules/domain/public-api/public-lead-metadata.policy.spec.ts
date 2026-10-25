import { Test } from "@nestjs/testing"
import type { LeadRequestBody } from "./public-api.contracts"
import { PublicApiErrorCode } from "./errors/public-api.error"
import { parsePublicLeadMetadata, publicLeadMetadata } from "./public-lead-metadata.policy"

const requestId = "11111111-1111-4111-8111-111111111111"
const otherId = "22222222-2222-4222-8222-222222222222"
const body: LeadRequestBody = {
    name: "Lan",
    contact: "84901234567",
    need: "Created through the API",
    needSupplied: true,
    channel: "API",
    company: "Hue Tea",
    note: "Send a quote",
    stage: "proposal",
    externalId: "crm-10",
    source: "api:CRM",
}
const metadata = () => ({ version: 1, completionId: requestId, ledgerRequestId: requestId, body })
const SUBJECT = Symbol("public-lead-metadata.policy")
type Subject = Pick<typeof import("./public-lead-metadata.policy"), "parsePublicLeadMetadata" | "publicLeadMetadata">

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { parsePublicLeadMetadata, publicLeadMetadata } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("public lead handoff metadata", () => {
    it("does nothing for an ordinary handoff without the reserved field", async () => {
        const subject = await build()

        expect(subject.parsePublicLeadMetadata(undefined)).toBeNull()
    })

    it("round trips the original ledger identity and admitted need presence", async () => {
        const subject = await build()
        const raw = subject.publicLeadMetadata(requestId, requestId, body)

        expect(raw).toBe(JSON.stringify(metadata()))
        expect(subject.parsePublicLeadMetadata(raw)).toEqual({
            completionId: requestId,
            ledgerRequestId: requestId,
            body,
        })
    })

    it("retains the inbound identity of a historical delivery without inventing a ledger request", async () => {
        const subject = await build()

        expect(subject.parsePublicLeadMetadata(subject.publicLeadMetadata(requestId, null, body))).toEqual({
            completionId: requestId,
            ledgerRequestId: null,
            body,
        })
    })

    it.each([null, 7, "{", "null", "[]", "{}", JSON.stringify({ ...metadata(), version: 2 })])(
        "refuses malformed reserved metadata: %p",
        async (raw) => {
            const subject = await build()

            expect(() => subject.parsePublicLeadMetadata(raw)).toThrow(PublicApiErrorCode.RequestInvalid)
        },
    )

    it.each([
        { completionId: 7 },
        { completionId: "not-an-id" },
        { ledgerRequestId: undefined },
        { ledgerRequestId: "not-an-id" },
        { ledgerRequestId: otherId },
        { body: { ...body, stage: "unsupported" } },
    ])("refuses invalid identities and customer facts: %p", async (patch) => {
        const subject = await build()

        expect(() => subject.parsePublicLeadMetadata(JSON.stringify({ ...metadata(), ...patch }))).toThrow(
            PublicApiErrorCode.RequestInvalid,
        )
    })
})
