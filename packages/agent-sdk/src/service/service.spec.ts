import { SdkDefinitionError } from "../block/definition-error"
import { definePort } from "../port/port"
import type { PortOf, PortProvider, RunContext } from "../port/port.types"
import { defineService, defineServiceContract, isServiceOf, serviceOf } from "./service"

interface Store {
    readonly open: (customer: string) => Promise<string>
}
interface Clockwork {
    readonly stamp: () => string
}

const STORE = defineServiceContract<Store>("engine.conversation-store")
const OTHER = defineServiceContract<Clockwork>("engine.clockwork")
const NOTES = definePort<{ readonly put: (text: string) => Promise<string> }>("fixture.notes")

const CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: null,
    now: new Date("2026-11-13T00:00:00Z"),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
}

/** The error a call throws. */
function captured(call: () => unknown): unknown {
    try {
        call()
    } catch (error) {
        return error
    }
    return undefined
}

const notesPort: PortOf<typeof NOTES> = { put: (text) => Promise.resolve(`stored:${text}`) }
const provider: PortProvider = { implementationOf: () => notesPort }

describe("defineServiceContract", () => {
    it("keeps the id and marks the entry", () => {
        expect(STORE).toEqual({ entry: "service-contract", id: "engine.conversation-store" })
    })

    it("refuses a malformed id", () => {
        expect(captured(() => defineServiceContract("Engine.Store"))).toMatchObject({
            code: "ID_MALFORMED",
            params: { at: "Engine.Store" },
            name: "SdkDefinitionError",
        })
    })
})

describe("defineService", () => {
    const config = {
        id: "fixture-pkg.chat.conversation-store",
        contract: STORE,
        moduleKey: "chat",
        ports: { notes: NOTES },
        build: (ports: { readonly notes: PortOf<typeof NOTES> }, context: RunContext): Store => ({
            open: (customer) => ports.notes.put(`${context.workspaceId}:${customer}`),
        }),
    }

    it("marks the entry and keeps the declaration", () => {
        const service = defineService(config)
        expect(service).toMatchObject({ entry: "service", id: config.id, moduleKey: "chat", contract: STORE })
    })

    it("refuses an id that is not <package>.<agent>.<name>", () => {
        expect(captured(() => defineService({ ...config, id: "conversation-store" }))).toMatchObject({
            code: "ID_MALFORMED",
            params: { at: "conversation-store" },
        })
        expect(captured(() => defineService({ ...config, id: "a.chat.b.c" }))).toMatchObject({ code: "ID_MALFORMED" })
    })

    it("refuses a service whose agent part is not its module key", () => {
        const error = captured(() => defineService({ ...config, moduleKey: "sales" }))
        expect(error).toBeInstanceOf(SdkDefinitionError)
        expect(error).toMatchObject({ code: "SERVICE_MODULE_MISMATCH", params: { at: config.id } })
    })
})

describe("serviceOf", () => {
    it("resolves the ports from the provider and builds with the run context", async () => {
        const asked: Array<string> = []
        const spy: PortProvider = {
            implementationOf: (port) => {
                asked.push(port.id)
                return notesPort
            },
        }
        const service = defineService({
            id: "fixture-pkg.chat.conversation-store",
            contract: STORE,
            moduleKey: "chat",
            ports: { notes: NOTES },
            build: (ports, context): Store => ({ open: (customer) => ports.notes.put(`${context.workspaceId}:${customer}`) }),
        })
        const built = serviceOf(service, spy, CONTEXT)
        expect(asked).toEqual(["fixture.notes"])
        expect(await built.open("c1")).toBe("stored:w1:c1")
    })

    it("builds a service with no ports", () => {
        const service = defineService({
            id: "fixture-pkg.chat.clockwork",
            contract: OTHER,
            moduleKey: "chat",
            ports: {},
            build: (_ports, context): Clockwork => ({ stamp: () => context.now.toISOString() }),
        })
        expect(serviceOf(service, provider, CONTEXT).stamp()).toBe("2026-11-13T00:00:00.000Z")
    })
})

describe("isServiceOf", () => {
    it("tells the services of one contract from another's", () => {
        const service = defineService({
            id: "fixture-pkg.chat.clockwork",
            contract: OTHER,
            moduleKey: "chat",
            ports: {},
            build: (_ports, context): Clockwork => ({ stamp: () => context.now.toISOString() }),
        })
        expect(isServiceOf(service, OTHER)).toBe(true)
        expect(isServiceOf(service, STORE)).toBe(false)
    })
})
