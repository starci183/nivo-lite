import { connectorStatusOf, isPlannedConnector } from "./connector-catalog.policy"

describe("connector catalog policy", () => {
    it("answers the status of a listed connector", () => {
        expect(connectorStatusOf("sepay")).toBe("official")
        expect(connectorStatusOf("meta")).toBe("early")
        expect(connectorStatusOf("shopee")).toBe("soon")
    })

    it("answers undefined for an id the catalog does not list, whatever its spelling", () => {
        expect(connectorStatusOf("nope")).toBeUndefined()
        expect(connectorStatusOf("constructor")).toBeUndefined()
    })

    it("accepts only planned connectors as wanted", () => {
        expect(isPlannedConnector("shopee")).toBe(true)
        expect(isPlannedConnector("sepay")).toBe(false)
        expect(isPlannedConnector("nope")).toBe(false)
    })
})
