import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import { defineService, defineServiceContract } from "@nivo-lite/agent-sdk/service"
import { installedPluginsOf } from "./installed-plugins.policy"

interface Greeter {
    readonly hello: () => string
}

const GREETER = defineServiceContract<Greeter>("engine.greeter")
const OTHER = defineServiceContract<Greeter>("engine.other")

const serviceOf = (id: string, moduleKey: string, contract = GREETER) =>
    defineService({ id, contract, moduleKey, ports: {}, build: (): Greeter => ({ hello: () => id }) })

const CHAT = serviceOf("fixpkg.chat.greeter", "chat")
const SALES = serviceOf("fixpkg.sales.greeter", "sales")

describe("installedPluginsOf services", () => {
    const installed = installedPluginsOf(defineInstallation([{ services: [CHAT] }, { services: [SALES] }], "h"))

    it("lists the services of every plugin, in installation order", () => {
        expect(installed.services().map((service) => service.id)).toEqual(["fixpkg.chat.greeter", "fixpkg.sales.greeter"])
    })

    it("answers the service of a contract for a module, typed by the contract", () => {
        const found = installed.serviceFor(GREETER, "sales")
        expect(found?.id).toBe("fixpkg.sales.greeter")
        expect(installed.serviceFor(GREETER, "chat")).toBe(CHAT)
    })

    it("answers null for a module that ships none, and for a contract no service implements", () => {
        expect(installed.serviceFor(GREETER, "video")).toBeNull()
        expect(installed.serviceFor(OTHER, "chat")).toBeNull()
    })

    it("lists none when nothing is installed", () => {
        const none = installedPluginsOf(defineInstallation([], "h"))
        expect(none.services()).toEqual([])
        expect(none.serviceFor(GREETER, "chat")).toBeNull()
    })
})
