import { Test } from "@nestjs/testing"
import { paramBag } from "./param-bag.policy"

const PARAM_BAG: unique symbol = Symbol("entity-engine.param-bag")

interface ParamBagPolicy {
    readonly paramBag: typeof paramBag
}

const build = async (): Promise<ParamBagPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: PARAM_BAG, useFactory: (): ParamBagPolicy => ({ paramBag }) }],
    }).compile()
    return moduleRef.get<ParamBagPolicy>(PARAM_BAG)
}

describe("paramBag", () => {
    it("names the values in binding order under its prefix", async () => {
        const { paramBag: bagOf } = await build()
        const bag = bagOf("p")

        expect([bag.bind("a"), bag.bind(2), bag.bind(["x"])]).toEqual(["p0", "p1", "p2"])
        expect(bag.values()).toEqual({ p0: "a", p1: 2, p2: ["x"] })
    })

    it("starts empty and keeps bags with different prefixes apart", async () => {
        const { paramBag: bagOf } = await build()
        const first = bagOf("f")
        const second = bagOf("s")
        second.bind(true)

        expect(first.values()).toEqual({})
        expect(second.values()).toEqual({ s0: true })
    })
})
