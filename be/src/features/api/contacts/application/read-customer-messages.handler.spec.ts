import { mock } from "@starci/jest-preset"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { CustomerMessagesService } from "@modules/domain/customer-routes"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { ReadCustomerMessagesQuery } from "./contacts.queries"
import { ReadCustomerMessagesHandler } from "./read-customer-messages.handler"

const PRINCIPAL: Principal = { id: "user-1", role: "authenticated" }
const REQUEST = { workspaceId: "ws-1", routeId: "route-1", after: "1763089140000.7", since: "2026-11-14T01:00:00.000Z", limit: 20 }

const build = () => {
    const access = mock<AgentWorkAccessService>()
    const lines = mock<CustomerMessagesService>()
    lines.threadOf.mockResolvedValue({ rows: [], next: null })
    const handler = new ReadCustomerMessagesHandler(mock<Logger>(), access, lines)
    return { access, lines, handler }
}

describe("ReadCustomerMessagesHandler (nivo.api.nivo.customer.message.list)", () => {
    it("checks the contacts page's seat, then reads the route's conversation, every state, with the page and the lower limit asked", async () => {
        const { access, lines, handler } = build()
        access.manager.mockResolvedValue("member-1")

        await expect(handler.execute(new ReadCustomerMessagesQuery({ request: REQUEST, principal: PRINCIPAL }))).resolves.toEqual({ rows: [], next: null })

        expect(access.manager).toHaveBeenCalledWith("user-1", "ws-1")
        expect(lines.threadOf).toHaveBeenCalledWith("ws-1", "route-1", { limit: 20, after: "1763089140000.7", since: "2026-11-14T01:00:00.000Z" })
    })

    it("reads nothing for a person without the seat", async () => {
        const { access, lines, handler } = build()
        access.manager.mockRejectedValue(new Error("not a manager"))

        await expect(handler.execute(new ReadCustomerMessagesQuery({ request: REQUEST, principal: PRINCIPAL }))).rejects.toThrow()
        expect(lines.threadOf).not.toHaveBeenCalled()
    })
})
