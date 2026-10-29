import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ApiKeysService } from "@modules/domain/api-keys"
import { EventsReadService } from "@modules/domain/events"
import { CLOCK } from "@modules/platform/clock"
import { PublicApiErrorCode } from "./errors/public-api.error"
import { PublicEventsService } from "./public-events.service"

const WHO = { keyId: "key-1", workspaceId: "workspace-1", name: "n8n", scopes: [] }

const AUTH = "Bearer nvk_secret"

const EVENT = {
    id: "event-1",
    kind: "api.lead",
    actor: "api:n8n",
    summary: "s",
    evidence: null,
    leadId: null,
    createdAt: "2026-10-12T09:30:00.000Z",
}

const build = async () => {
    const keys = mock<ApiKeysService>()
    keys.authenticate.mockResolvedValue(WHO)
    const eventReads = mock<EventsReadService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicEventsService,
            { provide: ApiKeysService, useValue: keys },
            { provide: EventsReadService, useValue: eventReads },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
        ],
    }).compile()
    return { service: moduleRef.get(PublicEventsService), keys, eventReads }
}

describe("PublicEventsService", () => {
    describe("listEvents", () => {
        it("admits the key for events:read, lists the events after since and answers the time of the last one as the next cursor", async () => {
            const { service, keys, eventReads } = await build()
            eventReads.listAfter.mockResolvedValue([EVENT])

            await expect(
                service.listEvents({ authorization: AUTH, since: "2026-10-12T00:00:00Z", limit: "10" }),
            ).resolves.toEqual({ events: [EVENT], nextSince: "2026-10-12T09:30:00.000Z" })

            expect(keys.authenticate).toHaveBeenCalledWith("events:read", AUTH)
            expect(eventReads.listAfter).toHaveBeenCalledWith("workspace-1", "2026-10-12T00:00:00.000Z", 10)
        })

        it("keeps the start of the window as the cursor when nothing happened, one day back and a hundred events by default", async () => {
            const { service, eventReads } = await build()
            eventReads.listAfter.mockResolvedValue([])

            await expect(service.listEvents({ authorization: AUTH })).resolves.toEqual({
                events: [],
                nextSince: "2026-10-11T10:00:00.000Z",
            })

            expect(eventReads.listAfter).toHaveBeenCalledWith("workspace-1", "2026-10-11T10:00:00.000Z", 100)
        })

        it("refuses a since that is not a time and reads nothing", async () => {
            const { service, eventReads } = await build()

            await expect(service.listEvents({ authorization: AUTH, since: "later" })).rejects.toMatchObject({
                code: PublicApiErrorCode.SinceInvalid,
            })

            expect(eventReads.listAfter).not.toHaveBeenCalled()
        })

        it("stops at a refused key before any read", async () => {
            const { service, keys, eventReads } = await build()
            const refused = new Error("API_KEYS_UNAUTHORIZED")
            keys.authenticate.mockRejectedValue(refused)

            await expect(service.listEvents({ authorization: undefined })).rejects.toBe(refused)

            expect(eventReads.listAfter).not.toHaveBeenCalled()
        })
    })
})
