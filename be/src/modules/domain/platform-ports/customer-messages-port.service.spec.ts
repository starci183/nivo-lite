import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { CustomerMessagesService, type CustomerLine } from "@modules/domain/customer-routes"
import { CustomerMessagesPortService } from "./customer-messages-port.service"

const HEARD: CustomerLine = {
    id: "l1",
    seq: "5",
    routeId: "route-1",
    contactId: "contact-1",
    direction: "from_person",
    key: "zl-1",
    saidAt: "2026-11-13T10:00:00.000Z",
    text: "Ch\u1ecb mu\u1ed1n \u0111\u1eb7t hoa",
    files: [{ url: "https://files/a.jpg", name: "a.jpg", contentType: "image/jpeg" }],
    order: null,
    eventId: "ev-1",
    agentId: null,
    memberId: null,
    runId: null,
    stepKey: null,
    state: null,
    reason: null,
    channel: "zalo",
    accountId: "conn-1",
    deliveredAt: null,
}

const TYPED: CustomerLine = {
    ...HEARD,
    id: "l2",
    seq: "6",
    direction: "to_person",
    key: "send-1",
    saidAt: "2026-11-13T10:01:00.000Z",
    text: "D\u1ea1 em b\u00e1o gi\u00e1 \u1ea1",
    files: [],
    eventId: null,
    memberId: "member-1",
    state: "refused",
    reason: "window_closed",
}

const build = async () => {
    const messages = mock<CustomerMessagesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [CustomerMessagesPortService, { provide: CustomerMessagesService, useValue: messages }],
    }).compile()
    return { service: moduleRef.get(CustomerMessagesPortService), messages }
}

describe("CustomerMessagesPortService port", () => {
    it("reads one route of the workspace of the run, every state, not narrowed by any agent, and hands out a line without its keys", async () => {
        const { service, messages } = await build()
        messages.threadOf.mockResolvedValue({ rows: [TYPED, HEARD], next: "1.5" })

        const page = await service
            .portFor("ws-1")
            .byRoute("route-1", { limit: 20, after: "9.9", since: "2026-11-01T00:00:00.000Z" })

        expect(messages.threadOf).toHaveBeenCalledWith("ws-1", "route-1", {
            limit: 20,
            after: "9.9",
            since: "2026-11-01T00:00:00.000Z",
            told: "all",
        })
        expect(page.next).toBe("1.5")
        expect(page.lines.map((line) => line.id)).toEqual(["l2", "l1"])
        expect(page.lines[0]).toMatchObject({
            direction: "to_person",
            memberId: "member-1",
            state: "refused",
            reason: "window_closed",
        })
        expect(page.lines[1]).toMatchObject({
            direction: "from_person",
            state: null,
            files: HEARD.files,
            accountId: "conn-1",
        })
        for (const line of page.lines) {
            for (const inner of ["seq", "key", "eventId", "runId", "stepKey"]) expect(line).not.toHaveProperty(inner)
        }
    })

    it("reads one person of the workspace of the run, with the default bound when none is asked", async () => {
        const { service, messages } = await build()
        messages.ofContact.mockResolvedValue({ rows: [], next: null })

        await expect(service.portFor("ws-2").byContact("contact-1")).resolves.toEqual({ lines: [], next: null })

        expect(messages.ofContact).toHaveBeenCalledWith("ws-2", "contact-1", {
            limit: undefined,
            after: undefined,
            since: undefined,
            told: "all",
        })
    })

    it("offers nothing that writes", async () => {
        const { service } = await build()

        expect(Object.keys(service.portFor("ws-1")).toSorted()).toEqual(["byContact", "byRoute"])
    })
})
