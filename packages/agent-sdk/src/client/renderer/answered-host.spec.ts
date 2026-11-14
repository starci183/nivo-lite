import type { WorkbenchHost } from "../../host/host.types"
import { sampleHostRead, sampleWorkbenchHost } from "../../tests/fixtures/fakes"
import { hostAnswering } from "./answered-host"

describe("hostAnswering", () => {
    it("answers a read the caller already ran from its answer, with no request to the live host", () => {
        const asked: Array<string> = []
        const base = sampleWorkbenchHost()
        const live: WorkbenchHost = {
            ...base,
            useRead: (operation, variables, options) => {
                asked.push(variables === null ? `${operation}:idle` : operation)
                return base.useRead(operation, variables, options)
            },
        }
        const host = hostAnswering(live, { "sales.api.order.of-contact": { rows: [{ id: "r1" }], cursor: null } })

        const read = host.useRead("sales.api.order.of-contact", { contactId: "c-1" })

        expect(read).toMatchObject({
            status: "ready",
            data: { rows: [{ id: "r1" }], cursor: null },
            isValidating: false,
            page: null,
        })
        expect(asked).toEqual(["sales.api.order.of-contact:idle"])
    })

    it("leaves every other read to the live host", () => {
        const live = sampleWorkbenchHost({ reads: { "sales.api.other": sampleHostRead("ready", "live") } })
        const host = hostAnswering(live, { "sales.api.order.of-contact": {} })

        expect(host.useRead("sales.api.other", { a: 1 })).toMatchObject({ status: "ready", data: "live" })
    })

    it("keeps the live host's other ports", () => {
        const live = sampleWorkbenchHost()
        const host = hostAnswering(live, {})

        expect(host.block).toBe(live.block)
        expect(host.useCan).toBe(live.useCan)
    })
})
