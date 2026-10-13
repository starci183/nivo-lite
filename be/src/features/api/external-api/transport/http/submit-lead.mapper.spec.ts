import { builder } from "@starci/jest-preset"
import type { SubmitLeadResult } from "../../application/submit-lead.contracts"
import type { SubmitLeadRequest } from "./dto/submit-lead.request"
import { toSubmitLeadRequest, toSubmitLeadResponse } from "./submit-lead.mapper"

const requestOf = builder<SubmitLeadRequest>({
    name: "An",
    phone: "0912000701",
    email: "an@example.test",
    company: "Cafe",
    need: "A booking",
    channel: "Zalo",
    external_id: "external-1",
    note: "Call tomorrow",
    stage: "qualified",
})

describe("submit lead mapper", () => {
    it("copies every lead field and maps external_id to the command name", () => {
        expect(toSubmitLeadRequest("Bearer nvk_1", requestOf())).toEqual({
            authorization: "Bearer nvk_1",
            name: "An",
            phone: "0912000701",
            email: "an@example.test",
            company: "Cafe",
            need: "A booking",
            channel: "Zalo",
            externalId: "external-1",
            note: "Call tomorrow",
            stage: "qualified",
        })
    })

    it("preserves absent optional fields", () => {
        expect(toSubmitLeadRequest(undefined, { name: "An" })).toEqual({
            authorization: undefined,
            name: "An",
            phone: undefined,
            email: undefined,
            company: undefined,
            need: undefined,
            channel: undefined,
            externalId: undefined,
            note: undefined,
            stage: undefined,
        })
    })

    it.each<SubmitLeadResult["status"]>(["accepted", "unchanged"])(
        "maps a %s hand-over to its lead id and status",
        (status) => {
            expect(toSubmitLeadResponse({ leadId: "lead-1", status })).toEqual({
                data: { lead_id: "lead-1", status },
            })
        },
    )

    it("preserves a lead id that has not been assigned yet", () => {
        expect(toSubmitLeadResponse({ leadId: null, status: "accepted" })).toEqual({
            data: { lead_id: null, status: "accepted" },
        })
    })
})
