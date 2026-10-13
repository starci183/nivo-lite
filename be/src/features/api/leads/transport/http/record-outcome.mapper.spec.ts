import { builder } from "@starci/jest-preset"
import type { RecordOutcomeResult } from "../../application/record-outcome.contracts"
import type { RecordOutcomeRequest } from "./dto/record-outcome.request"
import { toRecordOutcomeRequest, toRecordOutcomeResponse } from "./record-outcome.mapper"

const requestOf = builder<RecordOutcomeRequest>({ stage: "won", evidence: "Customer signed" })
const resultOf = builder<RecordOutcomeResult>({
    leadId: "lead-1",
    stage: "won",
    contactName: "An",
    company: "Cafe",
    channel: "meta",
    need: "Support",
    origin: "live",
    handedToAccounting: true,
})

describe("record-outcome mapper", () => {
    it("copies the outcome with the lead, workspace and language", () => {
        expect(toRecordOutcomeRequest("workspace-1", "lead-1", requestOf(), "en")).toEqual({
            leadId: "lead-1",
            stage: "won",
            evidence: "Customer signed",
            workspaceId: "workspace-1",
            acceptLanguage: "en",
        })
    })

    it("preserves empty evidence and an absent language", () => {
        expect(
            toRecordOutcomeRequest("workspace-2", "lead-2", requestOf({ stage: "lost", evidence: "" }), undefined),
        ).toEqual({
            leadId: "lead-2",
            stage: "lost",
            evidence: "",
            workspaceId: "workspace-2",
            acceptLanguage: undefined,
        })
    })

    it("copies every recorded outcome field into a separate response", () => {
        const result = resultOf()
        const response = toRecordOutcomeResponse(result)

        expect(response).toEqual({
            leadId: "lead-1",
            stage: "won",
            contactName: "An",
            company: "Cafe",
            channel: "meta",
            need: "Support",
            origin: "live",
            handedToAccounting: true,
        })
        expect(response).not.toBe(result)
    })

    it("preserves an unknown origin and an outcome with no accounting handoff", () => {
        expect(toRecordOutcomeResponse(resultOf({ origin: null, handedToAccounting: false }))).toEqual({
            leadId: "lead-1",
            stage: "won",
            contactName: "An",
            company: "Cafe",
            channel: "meta",
            need: "Support",
            origin: null,
            handedToAccounting: false,
        })
    })
})
