import { builder } from "@starci/jest-preset"
import type { LeadListItem } from "@modules/domain/public-api"
import { toListLeadsRequest, toListLeadsResponse } from "./list-leads.mapper"

const leadOf = builder<LeadListItem>({
    id: "lead-1",
    name: "An",
    company: "Cafe",
    channel: "API",
    need: "A booking",
    stage: "qualified",
    phone: "84912000701",
    email: "an@example.test",
    createdAt: "2026-10-13T10:00:00.000Z",
})

describe("list leads mapper", () => {
    it("maps the HTTP status filter to stage and preserves the unparsed limit", () => {
        expect(toListLeadsRequest("Bearer nvk_1", { status: "qualified", limit: "025" })).toEqual({
            authorization: "Bearer nvk_1",
            stage: "qualified",
            limit: "025",
        })
        expect(toListLeadsRequest(undefined, {})).toEqual({
            authorization: undefined,
            stage: undefined,
            limit: undefined,
        })
    })

    it("copies every lead field and maps the creation time to the wire name", () => {
        expect(toListLeadsResponse([leadOf()])).toEqual({
            data: [
                {
                    id: "lead-1",
                    name: "An",
                    company: "Cafe",
                    channel: "API",
                    need: "A booking",
                    stage: "qualified",
                    phone: "84912000701",
                    email: "an@example.test",
                    created_at: "2026-10-13T10:00:00.000Z",
                },
            ],
        })
    })

    it("wraps an empty list", () => {
        expect(toListLeadsResponse([])).toEqual({ data: [] })
    })
})
