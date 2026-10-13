import { builder } from "@starci/jest-preset"
import type { EventListItem } from "@modules/domain/public-api"
import { toListEventsRequest, toListEventsResponse } from "./list-events.mapper"

const eventOf = builder<EventListItem>({
    id: "event-1",
    kind: "api.lead",
    actor: "api:key-1",
    summary: "Lead accepted",
    evidence: "Request received",
    leadId: "lead-1",
    createdAt: "2026-10-13T10:00:00.000Z",
})

describe("list events mapper", () => {
    it("copies the authorization, cursor and unparsed limit", () => {
        expect(toListEventsRequest("Bearer nvk_1", { since: "2026-10-01", limit: "025" })).toEqual({
            authorization: "Bearer nvk_1",
            since: "2026-10-01",
            limit: "025",
        })
        expect(toListEventsRequest(undefined, {})).toEqual({
            authorization: undefined,
            since: undefined,
            limit: undefined,
        })
    })

    it("maps all event fields to wire names and preserves the next cursor", () => {
        expect(toListEventsResponse({ events: [eventOf()], nextSince: "2026-10-13T10:00:00.000Z" })).toEqual({
            data: {
                events: [
                    {
                        id: "event-1",
                        kind: "api.lead",
                        actor: "api:key-1",
                        summary: "Lead accepted",
                        evidence: "Request received",
                        lead_id: "lead-1",
                        created_at: "2026-10-13T10:00:00.000Z",
                    },
                ],
                next_since: "2026-10-13T10:00:00.000Z",
            },
        })
    })

    it("keeps an empty page and its cursor", () => {
        expect(toListEventsResponse({ events: [], nextSince: "2026-10-01T00:00:00.000Z" })).toEqual({
            data: { events: [], next_since: "2026-10-01T00:00:00.000Z" },
        })
    })
})
