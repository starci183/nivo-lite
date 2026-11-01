import { Test } from "@nestjs/testing"
import type { IntentBusiness } from "./intent-contracts.contracts"
import { resolveContracts } from "./intent-contract.policy"
import type { ContractSource } from "./intent-contract.policy"
import { frameOfIntent } from "./intent-frames.policy"

const SUBJECT = Symbol("intent-contract.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { resolveContracts } }],
    }).compile()
    return moduleRef.get<{ resolveContracts: typeof resolveContracts }>(SUBJECT)
}

const say = (key: string): string => `[${key}]`

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
        const frame = frameOfIntent(intent, ACTIONS, trigger)
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
    it("words the task and the fixed limits of the audience", async () => {
        const subject = await build()

        const [contract] = subject.resolveContracts(
            sourcesOf(["reply_customer"], "customer_message"),
            "customer_message",
            "customer",
            say,
        )

        expect(contract).toMatchObject({
            intent: "reply_customer",
            label: "reply_customer",
            risk: "none",
            task: "[intentContracts.task.reply_customer]",
            result: "customer_reply",
            owns: [],
        })
        expect(contract?.limits[0]).toBe("[intentContracts.limit.reply_style]")
        expect(contract?.limits).toContain("[intentContracts.limit.order]")
    })

    it("leaves out the limit about a member another offered intent owns", async () => {
        const subject = await build()
        const sources = sourcesOf(["reply_customer", "handoff_lead", "confirm_order"], "customer_message")

        const [replying, handing, ordering] = subject.resolveContracts(sources, "customer_message", "customer", say)

        expect(replying?.limits).not.toContain("[intentContracts.limit.lead]")
        expect(replying?.limits).not.toContain("[intentContracts.limit.order]")
        expect(handing?.limits).toContain("[intentContracts.limit.lead]")
        expect(handing?.limits).not.toContain("[intentContracts.limit.order]")
        expect(ordering?.limits).toContain("[intentContracts.limit.order]")
    })

    it("gives a tag the limits of its audience and none to an audience the frame has none for", async () => {
        const subject = await build()
        const sources = sourcesOf(["send_quote"], "tag")

        const [manager] = subject.resolveContracts(sources, "tag", "manager", say)
        const [staff] = subject.resolveContracts(sources, "tag", "staff", say)
        const [customer] = subject.resolveContracts(sources, "tag", "customer", say)

        expect(manager?.limits).toContain("[intentContracts.limit.request_only]")
        expect(staff?.limits).toEqual(["[intentContracts.limit.staff]"])
        expect(customer?.limits).toEqual([])
    })
})

describe("resolveContracts > the business half", () => {
    it("adds the shop's task to the frame's and the limits that bind the trigger and audience", async () => {
        const subject = await build()
        const shop = business({
            task: "A booking means a deposit.",
            limits: [
                { text: "Always", triggers: [], audiences: [], sources: [] },
                { text: "Message only", triggers: ["customer_message"], audiences: ["customer"], sources: [] },
                { text: "Tag only", triggers: ["tag"], audiences: [], sources: [] },
                { text: "Manager only", triggers: [], audiences: ["manager"], sources: [] },
            ],
        })

        const [contract] = subject.resolveContracts(
            sourcesOf(["reply_customer"], "customer_message", shop),
            "customer_message",
            "customer",
            say,
        )

        expect(contract?.task).toBe("[intentContracts.task.reply_customer] A booking means a deposit.")
        expect(contract?.limits.slice(-2)).toEqual(["Always", "Message only"])
    })

    it("keeps the frame's task alone when the shop wrote none", async () => {
        const subject = await build()

        const [contract] = subject.resolveContracts(
            sourcesOf(["reply_customer"], "customer_message", business({ task: "  " })),
            "customer_message",
            "customer",
            say,
        )

        expect(contract?.task).toBe("[intentContracts.task.reply_customer]")
    })
})
