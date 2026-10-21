import { Test } from "@nestjs/testing"
import { GATEWAY_STEPS_MAX, gatewayStepsOf as realGatewayStepsOf } from "./gateway-steps.policy"

const SUBJECT = Symbol("gateway-steps.policy")

/** The policy as the testing module provides it. */
const build = async (): Promise<Pick<typeof import("./gateway-steps.policy"), "gatewayStepsOf">> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { gatewayStepsOf: realGatewayStepsOf },
            },
        ],
    }).compile()
    return moduleRef.get<Pick<typeof import("./gateway-steps.policy"), "gatewayStepsOf">>(SUBJECT)
}

describe("gateway-steps.policy", () => {
    it("reads the named calls of a sequence in order, with no arguments when a step gives none", async () => {
        const { gatewayStepsOf } = await build()
        expect(
            gatewayStepsOf(
                JSON.stringify([
                    { name: " crm.stay.checkIn ", arguments: { stayId: "s1" } },
                    { name: "crm.key.send", arguments: [1] },
                    { name: "crm.note" },
                ]),
            ),
        ).toEqual([
            { name: "crm.stay.checkIn", arguments: { stayId: "s1" } },
            { name: "crm.key.send", arguments: {} },
            { name: "crm.note", arguments: {} },
        ])
    })

    it("clips a long tool name", async () => {
        const { gatewayStepsOf } = await build()
        expect(gatewayStepsOf(JSON.stringify([{ name: "x".repeat(300) }]))?.[0]?.name).toHaveLength(200)
    })

    it.each([
        ["no text", undefined],
        ["no JSON", "steps"],
        ["no list", '{"name":"crm.a"}'],
        ["an empty list", "[]"],
        ["more than ten steps", JSON.stringify(Array.from({ length: 11 }, () => ({ name: "crm.a" })))],
        ["a step that is no object", '[{"name":"crm.a"}, 3]'],
        ["a step without a name", '[{"arguments":{}}]'],
        ["a step with a blank name", '[{"name":"  "}]'],
        ["a step whose name is no text", '[{"name":7}]'],
    ])("refuses %s whole", async (_case, text) => {
        const { gatewayStepsOf } = await build()
        expect(GATEWAY_STEPS_MAX).toBe(10)
        expect(gatewayStepsOf(text)).toBeNull()
    })
})
