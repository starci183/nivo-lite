import { Test } from "@nestjs/testing"
import { openSourcesOf, type OfferModule } from "./openapi-workbench.policy"

const SUBJECT = Symbol("openapi-workbench.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { openSourcesOf } }],
    }).compile()
    return moduleRef.get<typeof import("./openapi-workbench.policy")>(SUBJECT)
}

/** The sources the installed plugins declare. */
const SOURCES: ReadonlyArray<string> = ["crm.acme", "crm.other"]

/** A module whose agent holds two operations of the CRM `crm.acme` and a core tool. */
const acme = (open: boolean): OfferModule => ({
    open,
    tools: ["nivo.api.crm.acme.get.customers", "nivo.api.crm.acme.post.customers", "nivo.tool.brain.search"],
})

describe("openSourcesOf", () => {
    it("opens every source an open module's agent uses by the static rule: an operation `nivo.api.<provider key>.…` uses `<provider key>`", () => {
        expect([...openSourcesOf([acme(true)], SOURCES)]).toEqual(["crm.acme"])
    })

    it("opens no source no open module uses, and never a level or a namespace taken for a source", async () => {
        const policy = await build()

        expect([...policy.openSourcesOf([{ open: true, tools: ["nivo.tool.brain.search", "nivo.api.crm.another.get.orders", "nivo.tool.invoice.create", "nivo.api.crm.acmex.get.orders", "other.order.list"] }], SOURCES)]).toEqual([])
    })

    it("gives a workspace the private plugin does not name nothing of its source, also when another open module uses it", () => {
        expect([...openSourcesOf([acme(false)], SOURCES)]).toEqual([])
        expect([...openSourcesOf([acme(false), acme(true)], SOURCES)]).toEqual([])
        expect([...openSourcesOf([], SOURCES)]).toEqual([])
    })
})
