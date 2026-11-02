import { Test } from "@nestjs/testing"
import { AgentPluginsService } from "@modules/domain/agent-plugins"
import { AGENTS_MESSAGES } from "@modules/domain/agents"
import { IntentRegistryService, resolveContracts } from "@modules/domain/intent-contracts"
import { MODULE_CATALOG } from "@modules/domain/modules"
import { REPLY_CHECK_MAX } from "./customer-intents.policy"
import { CustomerIntentsService } from "./customer-intents.service"
import { CUSTOMER_INTENTS_MESSAGES } from "./messages/customer-intents.messages"

/** The registry and the bounds, once the customer reply registered itself the way the module does when it starts. */
interface World {
    readonly registry: IntentRegistryService
    readonly max: number
}

const build = async (): Promise<World> => {
    const moduleRef = await Test.createTestingModule({
        providers: [CustomerIntentsService, AgentPluginsService, IntentRegistryService],
    }).compile()
    moduleRef.get(CustomerIntentsService).onModuleInit()
    return { registry: moduleRef.get(IntentRegistryService), max: REPLY_CHECK_MAX }
}

const catalogue = MODULE_CATALOG.flatMap((module) =>
    module.authorityActions.map((action) => ({ action: action.action, amountLimit: action.amountLimit })),
)

const check = (registry: IntentRegistryService, key: string, result: Readonly<Record<string, unknown>>): boolean =>
    registry.checkOf(key)?.({ intent: "reply_customer", result }) ?? false

describe("the customer reply as a domain > every catalogue action", () => {
    it.each(catalogue.map((entry) => [entry.action, entry] as const))(
        "resolves %s to a frame a tag can ask for",
        async (_name, entry) => {
            const { registry } = await build()

            expect(registry.frameOf(entry.action, catalogue, "tag")?.intent).toBe(entry.action)
        },
    )

    it("gives an action that is not in the catalogue no frame", async () => {
        const { registry } = await build()

        expect(registry.frameOf("invent_work", catalogue, "tag")).toBeNull()
        expect(registry.frameOf("invent_work", catalogue, "customer_message")).toBeNull()
    })
})

describe("the customer reply as a domain > the reply family", () => {
    const FAMILY = [
        "reply_customer",
        "handoff_lead",
        "confirm_order",
        "gateway_call",
        "confirm_booking",
        "redeem_reward",
        "screen_candidate",
    ]

    it.each(FAMILY)("gives %s a customer message frame read by the customer reply", async (intent) => {
        const { registry } = await build()

        const frame = registry.frameOf(intent, catalogue, "customer_message")

        expect(frame).toMatchObject({ result: "customer_reply", triggers: ["customer_message"] })
        expect(frame?.ownTurn).toBe(intent === "gateway_call")
        expect(frame?.answers).toBe(intent === "reply_customer")
        expect(frame?.limitKeys.outsider?.length).toBeGreaterThan(8)
    })

    it("runs the gateway call in a turn of its own for a tag too, and the other actions not", async () => {
        const { registry } = await build()

        expect(registry.frameOf("gateway_call", catalogue, "tag")?.ownTurn).toBe(true)
        expect(registry.frameOf("reply_customer", catalogue, "tag")?.ownTurn).toBe(false)
    })

    it("names the members each intent owns and the rule each member is about", async () => {
        const { registry } = await build()
        const frame = (intent: string) => registry.frameOf(intent, catalogue, "customer_message")

        expect(frame("handoff_lead")?.owns).toEqual(["lead"])
        expect(frame("confirm_order")?.owns).toEqual(["order"])
        expect(frame("confirm_booking")?.owns).toEqual(["booking_request"])
        expect(frame("redeem_reward")?.owns).toEqual(["loyalty"])
        expect(frame("screen_candidate")?.owns).toEqual(["application"])
        expect(frame("reply_customer")?.owns).toEqual([])
        expect(Object.values(frame("reply_customer")?.limitMembers ?? {})).toEqual(
            expect.arrayContaining(["lead", "order", "booking_request", "loyalty", "application"]),
        )
    })

    it("has no customer frame for an intent the module does not hold", async () => {
        const { registry } = await build()

        expect(
            registry.frameOf("confirm_order", [{ action: "reply_customer", amountLimit: false }], "customer_message"),
        ).toBeNull()
    })
})

describe("the customer reply as a domain > the checks", () => {
    it("wants a reply that is present and short", async () => {
        const { registry, max } = await build()

        expect(check(registry, "reply_present", { reply: "Hi" })).toBe(true)
        expect(check(registry, "reply_present", { reply: "  " })).toBe(false)
        expect(check(registry, "reply_bounded", { reply: "a".repeat(max) })).toBe(true)
        expect(check(registry, "reply_bounded", { reply: "a".repeat(max + 1) })).toBe(false)
        expect(check(registry, "reply_bounded", { reply: 3 })).toBe(false)
    })

    it("holds a lead to a contact name and a need, and lets an absent lead pass", async () => {
        const { registry } = await build()

        expect(check(registry, "lead_complete", { lead: null })).toBe(true)
        expect(check(registry, "lead_complete", { lead: { contact_name: "An", need: "a quote" } })).toBe(true)
        expect(check(registry, "lead_complete", { lead: { contact_name: "An", need: " " } })).toBe(false)
    })

    it("holds an order to its items and a whole amount above zero", async () => {
        const { registry } = await build()
        const order = (patch: Record<string, unknown>) => ({ order: { items: "Combo", amount_vnd: 90_000, ...patch } })

        expect(check(registry, "order_complete", { order: null })).toBe(true)
        expect(check(registry, "order_complete", order({}))).toBe(true)
        expect(check(registry, "order_complete", order({ items: "" }))).toBe(false)
        expect(check(registry, "order_complete", order({ amount_vnd: "90000" }))).toBe(false)
        expect(check(registry, "order_price_known", order({}))).toBe(true)
        expect(check(registry, "order_price_known", order({ amount_vnd: 0 }))).toBe(false)
    })
})

describe("the customer reply as a domain > the words", () => {
    const say = (key: string): string => CUSTOMER_INTENTS_MESSAGES.en?.[key] ?? `?${key}`

    it.each(["en", "vi"] as const)("keeps the sentences of the %s legacy reply contract word for word", (locale) => {
        const legacy = AGENTS_MESSAGES[locale]?.["bundle.replyContract"] ?? ""
        const localeSay = (key: string): string => CUSTOMER_INTENTS_MESSAGES[locale]?.[key] ?? `?${key}`
        const limits = [
            "reply_style",
            "lead",
            "authority",
            "routine",
            "otherwise",
            "order",
            "payment_claim",
            "knowledge_gap",
            "proposal",
        ]

        expect(limits.filter((key) => !legacy.includes(localeSay(`intentContracts.limit.${key}`)))).toEqual([])
        const paymentClaim = localeSay("intentContracts.limit.payment_claim")
        expect(paymentClaim).toContain("Never say the payment is received.")
        expect(paymentClaim).toContain("an [ATTACHED FILE] block shows a transfer")
        expect(paymentClaim).toContain("Use only the amount the attached block states")
        expect(paymentClaim).toContain("ask the customer to send a clearer file")
    })

    it("holds the same keys in Vietnamese and English", () => {
        expect(Object.keys(CUSTOMER_INTENTS_MESSAGES.vi ?? {}).sort()).toEqual(
            Object.keys(CUSTOMER_INTENTS_MESSAGES.en ?? {}).sort(),
        )
    })

    it("words every key the frames name", async () => {
        const { registry } = await build()
        const sources = [
            "reply_customer",
            "handoff_lead",
            "confirm_order",
            "confirm_booking",
            "redeem_reward",
            "screen_candidate",
        ].flatMap((intent) => {
            const frame = registry.frameOf(intent, catalogue, "customer_message")
            return frame === null ? [] : [{ frame, label: intent, business: null }]
        })

        const contracts = resolveContracts(sources, "customer_message", "outsider", say)

        expect(
            contracts.flatMap((contract) => [contract.task, ...contract.limits]).filter((text) => text.startsWith("?")),
        ).toEqual([])
    })
})
