import { Test } from "@nestjs/testing"
import { TOOL } from "@nivo-lite/blocks-core"
import { LanggraphErrorCode } from "../errors/langgraph.error"
import { idOfWireName, toolNamesOf, wireNameOf } from "./tool-names.policy"

/** The members of the subject under test. */
interface Subject {
    readonly idOfWireName: typeof idOfWireName
    readonly toolNamesOf: typeof toolNamesOf
    readonly wireNameOf: typeof wireNameOf
}

const SUBJECT = Symbol("tool-names.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { idOfWireName, toolNamesOf, wireNameOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** Every tool id the install names: what the agent of a step may call. */
const INSTALLED: ReadonlyArray<string> = Object.values(TOOL)

/** The same ids under the `nivo.` prefix the design gives the native tools: the map must hold for them too. */
const PREFIXED = INSTALLED.map((id) => `nivo.${id}`)

describe("tool-names.policy: the wire names of tool ids", () => {
    it.each([...INSTALLED, ...PREFIXED])("%s maps into a legal name of at most 64 characters, and back", async (id) => {
        const names = await build()

        const wire = names.wireNameOf(id)

        expect(wire).toMatch(/^[a-zA-Z0-9_-]{1,64}$/)
        expect(names.idOfWireName(wire ?? "")).toBe(id)
    })

    it("maps every installed id to a name of its own", async () => {
        const names = await build()

        const wires = [...INSTALLED, ...PREFIXED].map((id) => names.wireNameOf(id))

        expect(new Set(wires).size).toBe(wires.length)
        expect(INSTALLED.length).toBeGreaterThan(20)
    })

    it("holds no installed id with `__` in it: the way back is certain", () => {
        expect(INSTALLED.filter((id) => id.includes("__"))).toEqual([])
    })

    it("gives no wire name to an id that could not come back, or that is too long or illegal once mapped", async () => {
        const names = await build()

        expect(names.wireNameOf("order__draft.create")).toBeNull()
        expect(names.wireNameOf(`connector.${"a".repeat(80)}`)).toBeNull()
        expect(names.wireNameOf("order create")).toBeNull()
        expect(names.wireNameOf("")).toBeNull()
    })
})

describe("tool-names.policy: the names of one run", () => {
    it("changes nothing with the map off, which is the default", async () => {
        const names = (await build()).toolNamesOf(INSTALLED, false)

        expect(INSTALLED.map((id) => names.shown(id))).toEqual(INSTALLED)
        expect(names.idOf("nivo.lead.message.send")).toBe("nivo.lead.message.send")
        expect(names.idOf("nivo__lead__message__send")).toBe("nivo__lead__message__send")
    })

    it("shows each id under its wire name with the map on and reads it back, one to one", async () => {
        const names = (await build()).toolNamesOf(INSTALLED, true)

        expect(INSTALLED.filter((id) => names.shown(id).includes("."))).toEqual([])
        expect(INSTALLED.map((id) => names.idOf(names.shown(id)))).toEqual(INSTALLED)
    })

    it("refuses by name a set with an id that has no wire name, only with the map on", async () => {
        const policy = await build()
        const ids = ["order.read", "order__draft.create"]

        const refused = ((): unknown => {
            try {
                return policy.toolNamesOf(ids, true)
            } catch (cause) {
                return cause
            }
        })()

        expect(refused).toMatchObject({ code: LanggraphErrorCode.ToolNameUnmappable, params: { name: "order__draft.create" } })
        expect(policy.toolNamesOf(ids, false).shown("order__draft.create")).toBe("order__draft.create")
    })

    it("reads a name the model made up back with dots, and the tools of the loop itself as they are", async () => {
        const names = (await build()).toolNamesOf(["order.read"], true)

        expect(names.idOf("order__void")).toBe("order.void")
        expect(names.idOf("done")).toBe("done")
    })
})
