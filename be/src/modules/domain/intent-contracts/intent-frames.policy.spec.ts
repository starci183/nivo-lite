import { Test } from "@nestjs/testing"
import { MODULE_CATALOG } from "@modules/domain/modules"
import { LIMIT_MEMBERS, REPLY_INTENTS, frameOfIntent } from "./intent-frames.policy"

const SUBJECT = Symbol("intent-frames.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { frameOfIntent } }],
    }).compile()
    return moduleRef.get<{ frameOfIntent: typeof frameOfIntent }>(SUBJECT)
}

const catalogue = MODULE_CATALOG.flatMap((module) =>
    module.authorityActions.map((action) => ({ action: action.action, amountLimit: action.amountLimit })),
)

describe("frameOfIntent > the catalogue", () => {
    it.each(catalogue.map((action) => [action.action, action] as const))(
        "gives the catalogue action %s a frame a tag can ask for",
        async (_name, action) => {
            const subject = await build()

            const frame = subject.frameOfIntent(action.action, [action], "tag")

            expect(frame?.intent).toBe(action.action)
            expect(frame?.result).toBe("agent_request")
            expect(frame?.triggers).toEqual(["tag"])
            expect(frame?.risk).toBe(action.amountLimit ? "money" : action.action === "gateway_call" ? "write" : "none")
        },
    )

    it("walks every action of every module", () => {
        expect(catalogue.length).toBeGreaterThan(40)
        expect(MODULE_CATALOG.every((module) => module.authorityActions.length > 0)).toBe(true)
    })

    it("gives money to an amount limited action and write to the gateway call", async () => {
        const subject = await build()

        expect(subject.frameOfIntent("send_quote", [{ action: "send_quote", amountLimit: true }], "tag")?.risk).toBe(
            "money",
        )
        expect(
            subject.frameOfIntent("gateway_call", [{ action: "gateway_call", amountLimit: false }], "tag")?.risk,
        ).toBe("write")
    })

    it("has no frame for an intent that is not in the catalogue", async () => {
        const subject = await build()

        expect(subject.frameOfIntent("invent_work", catalogue, "tag")).toBeNull()
        expect(subject.frameOfIntent("invent_work", catalogue, "customer_message")).toBeNull()
    })
})

describe("frameOfIntent > the reply family", () => {
    const actions = REPLY_INTENTS.map((action) => ({ action, amountLimit: false }))

    it.each(REPLY_INTENTS)("gives %s a customer frame with the customer reply result", async (intent) => {
        const subject = await build()

        const frame = subject.frameOfIntent(intent, actions, "customer_message")

        expect(frame?.triggers).toEqual(["customer_message"])
        expect(frame?.result).toBe("customer_reply")
        expect(frame?.limitKeys.customer?.length).toBeGreaterThan(8)
        expect(frame?.risk).toBe(intent === "gateway_call" ? "write" : "none")
    })

    it("names the members each reply intent owns", async () => {
        const subject = await build()
        const owns = (intent: string) => subject.frameOfIntent(intent, actions, "customer_message")?.owns

        expect(owns("handoff_lead")).toEqual(["lead"])
        expect(owns("confirm_order")).toEqual(["order"])
        expect(owns("confirm_booking")).toEqual(["booking_request"])
        expect(owns("redeem_reward")).toEqual(["loyalty"])
        expect(owns("screen_candidate")).toEqual(["application"])
        expect(owns("reply_customer")).toEqual([])
    })

    it("has no customer frame for an intent the module does not hold", async () => {
        const subject = await build()

        expect(
            subject.frameOfIntent(
                "confirm_order",
                [{ action: "reply_customer", amountLimit: false }],
                "customer_message",
            ),
        ).toBeNull()
    })

    it("ties the lead and order rules to their members", () => {
        expect(Object.values(LIMIT_MEMBERS)).toEqual(
            expect.arrayContaining(["lead", "order", "booking_request", "loyalty", "application"]),
        )
    })
})
