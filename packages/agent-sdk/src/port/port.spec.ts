import { SdkDefinitionError } from "../block/definition-error"
import type { PortOf, PortProvider } from "./port.types"
import { definePort, portsOf, unprovided } from "./port"

interface Plan {
    readonly load: (date: string) => Promise<ReadonlyArray<string>>
}
interface Holds {
    readonly insert: (id: string) => Promise<boolean>
}

const PLAN = definePort<Plan>("booking.plan")
const HOLDS = definePort<Holds>("booking.holds")

/** The error a call throws. */
function captured(call: () => unknown): unknown {
    try {
        call()
    } catch (error) {
        return error
    }
    return undefined
}

describe("definePort", () => {
    it("keeps the id and marks the entry", () => {
        expect(PLAN).toEqual({ entry: "port", id: "booking.plan" })
    })

    it("refuses a malformed id", () => {
        expect(captured(() => definePort("Booking.Plan"))).toMatchObject({
            code: "ID_MALFORMED",
            params: { at: "Booking.Plan" },
            name: "SdkDefinitionError",
        })
    })
})

describe("portsOf", () => {
    it("asks the provider for every port of the map and keeps the local names", async () => {
        const asked: Array<string> = []
        const plan: PortOf<typeof PLAN> = { load: (date) => Promise.resolve([date]) }
        const holds: PortOf<typeof HOLDS> = { insert: () => Promise.resolve(true) }
        const provider: PortProvider = {
            implementationOf: (port) => {
                asked.push(port.id)
                return port.id === "booking.plan" ? plan : holds
            },
        }
        const ports = portsOf(provider, { plan: PLAN, holds: HOLDS })
        expect(asked).toEqual(["booking.plan", "booking.holds"])
        expect(await ports.plan.load("2026-11-05")).toEqual(["2026-11-05"])
        expect(await ports.holds.insert("h1")).toBe(true)
    })

    it("builds nothing for an empty map", () => {
        const provider: PortProvider = { implementationOf: unprovided }
        expect(portsOf(provider, {})).toEqual({})
    })
})

describe("unprovided", () => {
    it("throws PORT_UNPROVIDED naming the port", () => {
        const error = captured(() => unprovided(PLAN))
        expect(error).toBeInstanceOf(SdkDefinitionError)
        expect(error).toMatchObject({ code: "PORT_UNPROVIDED", params: { at: "booking.plan" } })
    })
})
