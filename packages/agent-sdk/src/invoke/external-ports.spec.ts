import { doorPort } from "../mutation/door-port"
import { EXTERNAL_PORT_IDS, hasExternalPort } from "./external-ports"
import { counterPort } from "./invoke.fixture"

describe("hasExternalPort", () => {
    it("names the door and the workflow start as external", () => {
        expect(EXTERNAL_PORT_IDS).toEqual(["engine.door", "engine.workflow"])
    })

    it("is true when a port reaches outside the database", () => {
        expect(hasExternalPort({ a: counterPort, b: doorPort })).toBe(true)
    })

    it("is false for database ports only, and for no ports", () => {
        expect(hasExternalPort({ a: counterPort })).toBe(false)
        expect(hasExternalPort(undefined)).toBe(false)
    })
})
