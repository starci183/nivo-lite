import { Test } from "@nestjs/testing"
import type { IntentBusiness } from "./intent-contracts.contracts"
import { resolveContracts } from "./intent-contract.policy"
import type { ContractSource } from "./intent-contract.policy"
import { testRegistry } from "@tests/fixtures/builders/intent-domain.builder"

const SUBJECT = Symbol("intent-contract.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { resolveContracts } }],
    }).compile()
    return moduleRef.get<{ resolveContracts: typeof resolveContracts }>(SUBJECT)
}

const say = (key: string): string => `[${key}]`

const REGISTRY = testRegistry()

const ACTIONS = ["reply_customer", "handoff_lead", "confirm_order", "send_quote"].map((action) => ({
    action,
    amountLimit: false,
}))

const sourcesOf = (
    intents: ReadonlyArray<string>,
    trigger: "customer_message" | "tag",
    shop: IntentBusiness | null = null,
): ReadonlyArray<ContractSource> =>
    intents.flatMap((intent) => {
        const frame = REGISTRY.frameOf(intent, ACTIONS, trigger)
        return frame === null ? [] : [{ frame, label: intent, business: shop }]
    })

const business = (patch: Partial<IntentBusiness>): IntentBusiness => ({
    intent: "reply_customer",
    task: "",
    limits: [],
    sources: [],
    ...patch,
})

describe("resolveContracts > the frame", () => {
    it("words the task and the fixed limits of the trust", async () => {
        const subject = await build()

        const [contract] = subject.resolveContracts(
            sourcesOf(["reply_customer"], "customer_message"),
            "customer_message",
            "outsider",
            say,
        )

        expect(contract).toMatchObject({
            intent: "reply_customer",
            label: "reply_customer",
            ownTurn: false,
            task: "[task.reply_customer]",
            result: "test_answer",
            owns: [],
        })
        expect(contract?.limits[0]).toBe("[limit.style]")
        expect(contract?.limits).toContain("[limit.order]")
    })

    it("leaves out the limit about a member another offered intent owns", async () => {
        const subject = await build()
        const sources = sourcesOf(["reply_customer", "handoff_lead", "confirm_order"], "customer_message")

        const [replying, handing, ordering] = subject.resolveContracts(sources, "customer_message", "outsider", say)

        expect(replying?.limits).not.toContain("[limit.lead]")
        expect(replying?.limits).not.toContain("[limit.order]")
        expect(handing?.limits).toContain("[limit.lead]")
        expect(handing?.limits).not.toContain("[limit.order]")
        expect(ordering?.limits).toContain("[limit.order]")
    })

    it("gives a tag the limits of its trust and none to an trust the frame has none for", async () => {
        const subject = await build()
        const sources = sourcesOf(["send_quote"], "tag")

        const [manager] = subject.resolveContracts(sources, "tag", "manager", say)
        const [staff] = subject.resolveContracts(sources, "tag", "member", say)
        const [customer] = subject.resolveContracts(sources, "tag", "outsider", say)

        expect(manager?.limits).toContain("[intentContracts.limit.request_only]")
        expect(staff?.limits).toEqual(["[intentContracts.limit.staff]"])
        expect(customer?.limits).toEqual([])
    })
})

describe("resolveContracts > the business half", () => {
    it("adds the shop's task to the frame's and the limits that bind the trigger and trust", async () => {
        const subject = await build()
        const shop = business({
            task: "A booking means a deposit.",
            limits: [
                { text: "Always", triggers: [], trusts: [], sources: [] },
                { text: "Message only", triggers: ["customer_message"], trusts: ["outsider"], sources: [] },
                { text: "Tag only", triggers: ["tag"], trusts: [], sources: [] },
                { text: "Manager only", triggers: [], trusts: ["manager"], sources: [] },
            ],
        })

        const [contract] = subject.resolveContracts(
            sourcesOf(["reply_customer"], "customer_message", shop),
            "customer_message",
            "outsider",
            say,
        )

        expect(contract?.task).toBe("[task.reply_customer] A booking means a deposit.")
        expect(contract?.limits.slice(-2)).toEqual(["Always", "Message only"])
    })

    it("keeps the frame's task alone when the shop wrote none", async () => {
        const subject = await build()

        const [contract] = subject.resolveContracts(
            sourcesOf(["reply_customer"], "customer_message", business({ task: "  " })),
            "customer_message",
            "outsider",
            say,
        )

        expect(contract?.task).toBe("[task.reply_customer]")
    })
})
