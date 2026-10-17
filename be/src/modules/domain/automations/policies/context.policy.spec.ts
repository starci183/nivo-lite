import { Test } from "@nestjs/testing"
import { PATTERNS, buildInstallation } from "@tests/fixtures/builders/automations.builder"
import {
    PATTERN_CAPABILITIES,
    capabilitiesFrom as capabilitiesFromImplementation,
    contextVersionFor as contextVersionForImplementation,
    contextsFrom as contextsFromImplementation,
    factsFrom as factsFromImplementation,
    gateModeFor as gateModeForImplementation,
    shopContextFrom as shopContextFromImplementation,
} from "./context.policy"
import type { ActiveContexts } from "./context.policy"

const SUBJECT = Symbol("subject")
type Subject = {
    capabilitiesFrom: typeof capabilitiesFromImplementation
    contextVersionFor: typeof contextVersionForImplementation
    contextsFrom: typeof contextsFromImplementation
    factsFrom: typeof factsFromImplementation
    gateModeFor: typeof gateModeForImplementation
    shopContextFrom: typeof shopContextFromImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    capabilitiesFrom: capabilitiesFromImplementation,
                    contextVersionFor: contextVersionForImplementation,
                    contextsFrom: contextsFromImplementation,
                    factsFrom: factsFromImplementation,
                    gateModeFor: gateModeForImplementation,
                    shopContextFrom: shopContextFromImplementation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const contexts = (overrides: Partial<ActiveContexts> = {}): ActiveContexts => ({
    installed: [],
    versions: {},
    text: "",
    hoursText: "",
    operatingModes: {},
    ...overrides,
})

describe("contextsFrom", () => {
    it("collects the versions, the text, the hours of the gate and the operating mode of each module", async () => {
        const subject = await buildSubject()

        const result = subject.contextsFrom([
            buildInstallation({
                module_key: "sales",
                operating_mode: "assist",
                ctx: {
                    id: "c-1",
                    version: 3,
                    snapshot: {
                        summary: "We sell flowers.",
                        facts: [{ text: "Delivery in town." }],
                        gates: { hours_sla: { evidence: "Hours 8h-21h" }, other: {} },
                    },
                },
            }),
            buildInstallation({ module_key: "sales", operating_mode: "auto", ctx: null }),
            buildInstallation({
                module_key: "booking",
                ctx: { id: "c-2", version: 5, snapshot: { gates: { hours_sla: { evidence: "Hours 9h-17h" } } } },
            }),
            buildInstallation({ module_key: "care", ctx: { id: "c-3", version: 1, snapshot: {} } }),
        ])

        expect(result.installed).toEqual(["sales", "sales", "booking", "care"])
        expect(result.versions).toEqual({ sales: 3, booking: 5, care: 1 })
        expect(result.operatingModes).toEqual({ sales: "assist", booking: null, care: null })
        expect(result.hoursText).toBe("Hours 8h-21h")
        expect(result.text).toContain("We sell flowers.")
        expect(result.text).toContain("Delivery in town.")
    })

    it("knows nothing before any module is installed", async () => {
        const subject = await buildSubject()

        expect(subject.contextsFrom([])).toEqual({
            installed: [],
            versions: {},
            text: "",
            hoursText: "",
            operatingModes: {},
        })
    })
})

describe("shopContextFrom", () => {
    it("names the shop, its hours from the gate and the tone the owner set", async () => {
        const subject = await buildSubject()

        const shop = subject.shopContextFrom(
            "Tiem Hoa",
            { brand_voice: " warm ", reply_style: "short" },
            contexts({ hoursText: "Hours 8h-21h" }),
            PATTERNS,
        )

        expect(shop).toEqual({
            shop: "Tiem Hoa",
            hours: "08:00 - 21:00",
            tone: "warm",
            hoursRange: { from: 480, to: 1260 },
        })
    })

    it("reads context hours when the gate has none, and tone from reply style", async () => {
        const subject = await buildSubject()

        const shop = subject.shopContextFrom(
            null,
            { reply_style: "short" },
            contexts({ text: "We sell flowers\nOpening hours 9:00 - 18:00" }),
            PATTERNS,
        )

        expect(shop).toMatchObject({ shop: "shop", hours: "09:00 - 18:00", tone: "short" })
    })

    it("states no hours and no tone when the shop told none", async () => {
        const subject = await buildSubject()

        expect(subject.shopContextFrom("S", null, contexts({ text: "Opening hours vary" }), PATTERNS)).toEqual({
            shop: "S",
            hours: "",
            tone: "",
            hoursRange: null,
        })
        expect(subject.shopContextFrom("S", {}, contexts(), PATTERNS).tone).toBe("")
    })
})

describe("capabilitiesFrom", () => {
    const none = { contracts: 0, shipped: 0 }

    it("finds what the text affirms and ignores a sentence that denies it", async () => {
        const subject = await buildSubject()

        const text = "We take a deposit. No appointment needed. We sell online; delivery is free"
        const has = subject.capabilitiesFrom(contexts({ text }), [], 0, none, PATTERNS)

        expect([...has].sort()).toEqual(["has_deposits", "has_delivery", "sells_online"].sort())
    })

    it("reads the knowledge sources too, cut at three thousand characters", async () => {
        const subject = await buildSubject()

        const has = subject.capabilitiesFrom(
            contexts(),
            [
                { title: "Subscription plans", content: "..." },
                { title: "Notes", content: `${"x".repeat(3100)} deposit` },
            ],
            0,
            none,
            PATTERNS,
        )

        expect([...has]).toEqual(["has_recurring_contracts"])
    })

    it("adds the capabilities the installed modules and the data prove", async () => {
        const subject = await buildSubject()

        const has = subject.capabilitiesFrom(
            contexts({ installed: ["booking"], hoursText: "Hours 8h-21h" }),
            [],
            2,
            { contracts: 1, shipped: 4 },
            PATTERNS,
        )

        expect([...has].sort()).toEqual(
            [
                "has_appointments",
                "has_due_dates",
                "has_recurring_contracts",
                "has_delivery",
                "has_opening_hours",
            ].sort(),
        )
    })

    it("finds due dates and opening hours stated in the text", async () => {
        const subject = await buildSubject()

        const has = subject.capabilitiesFrom(
            contexts({ text: "Customers pay later.\nOur hours: 8h-21h" }),
            [],
            0,
            none,
            PATTERNS,
        )

        expect([...has].sort()).toEqual(["has_due_dates", "has_opening_hours"])
    })

    it("lists the capabilities a pattern can prove", () => {
        expect(PATTERN_CAPABILITIES).toHaveLength(5)
    })
})

describe("factsFrom", () => {
    const connections = [{ provider: "telegram", status: "active" }]

    it("takes a chat from the agents or from a live chat connection", async () => {
        const subject = await buildSubject()

        const capabilities = new Set<never>()

        expect(subject.factsFrom(contexts({ installed: ["sales"] }), capabilities, [], 1)).toMatchObject({
            installed: ["sales"],
            hasChat: true,
        })
        expect(subject.factsFrom(contexts(), capabilities, connections, 0).hasChat).toBe(true)
        expect(
            subject.factsFrom(contexts(), capabilities, [{ provider: "zalo_oa", status: "active" }], 0).hasChat,
        ).toBe(true)
        expect(
            subject.factsFrom(contexts(), capabilities, [{ provider: "telegram", status: "pending" }], 0).hasChat,
        ).toBe(false)
        expect(subject.factsFrom(contexts(), capabilities, [{ provider: "google", status: "active" }], 0).hasChat).toBe(
            false,
        )
    })
})

describe("contextVersionFor", () => {
    it("is the version of the module, or the highest of the installed modules for a workspace-wide template", async () => {
        const subject = await buildSubject()

        const versions = { sales: 3, booking: 5 }

        expect(subject.contextVersionFor("sales", versions)).toBe(3)
        expect(subject.contextVersionFor("care", versions)).toBeNull()
        expect(subject.contextVersionFor(null, versions)).toBe(5)
        expect(subject.contextVersionFor(null, {})).toBeNull()
    })
})

describe("gateModeFor", () => {
    const rules = [
        { department: "sales", action: "send_care", mode: "auto" as const },
        { department: "sales", action: "send_follow_up", mode: "ask" as const },
    ]

    it("is never for an action the owner set no rule for", async () => {
        const subject = await buildSubject()

        expect(subject.gateModeFor("reply_customer", rules, {})).toBe("never")
    })

    it("is the mode of the rule, with auto turned into ask while the department only assists", async () => {
        const subject = await buildSubject()

        expect(subject.gateModeFor("send_care", rules, { sales: null })).toBe("auto")
        expect(subject.gateModeFor("send_care", rules, { sales: "assist" })).toBe("ask")
        expect(subject.gateModeFor("send_follow_up", rules, { sales: "assist" })).toBe("ask")
    })
})
