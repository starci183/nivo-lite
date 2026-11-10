import { MODULE_DECLARATIONS } from "@nivo-lite/blocks-core/modules"
import { TOOL } from "@nivo-lite/blocks-core"
import type { ProviderAttachmentView } from "@modules/domain/mcp-tool-grants"
import { ABILITY_LABELS, KIND_LABELS, PROVIDER_LABELS } from "./messages/provider-abilities.labels"
import {
    PROVIDER_CATALOGUE,
    isAbilityTool,
    isChannelBound,
    judgeAbility,
    providerOfChannel,
    providerSpecOf,
    ticksOfTemplate,
    ticksOfWish,
} from "./provider-abilities.policy"

const row = (provider: string, abilities: ProviderAttachmentView["abilities"]): ProviderAttachmentView => ({
    agentId: "a1",
    provider,
    abilities,
})

const templateOf = (moduleKey: string) => MODULE_DECLARATIONS.find((module) => module.key === moduleKey)?.agent?.abilities

/** The ticks a module's defaults give on each provider of the catalogue it names. */
const defaultsOf = (moduleKey: string) =>
    Object.fromEntries(
        PROVIDER_CATALOGUE.flatMap((spec) => {
            const ticks = ticksOfTemplate(templateOf(moduleKey), spec)
            return ticks === null ? [] : [[spec.provider, ticks]]
        }),
    )

describe("the provider catalogue", () => {
    it("names every provider, kind and ability in both languages, and lists a tool once per provider", () => {
        for (const spec of PROVIDER_CATALOGUE) {
            expect([spec.provider, Object.hasOwn(PROVIDER_LABELS, spec.provider)]).toEqual([spec.provider, true])
            expect([spec.kind, Object.hasOwn(KIND_LABELS, spec.kind)]).toEqual([spec.kind, true])
            expect(Object.keys(ABILITY_LABELS[spec.provider] ?? {}).sort()).toEqual(spec.abilities.map((ability) => ability.id).sort())
            const tools = spec.abilities.flatMap((ability) => ability.tools)
            expect(new Set(tools).size).toBe(tools.length)
        }
    })

    it("has no ability on payOS, so no agent can be attached to it", () => {
        expect(providerSpecOf("payos")?.abilities).toEqual([])
        expect(ticksOfTemplate(templateOf("accounting"), providerSpecOf("payos") ?? PROVIDER_CATALOGUE[0]!)).toBeNull()
    })

    it("knows a provider right from NIVO's own tools, and the one tool whose provider only the conversation tells", () => {
        expect(isAbilityTool(TOOL.ledgerAppend)).toBe(true)
        expect(isAbilityTool(TOOL.paymentQrCreate)).toBe(true)
        expect(isAbilityTool(TOOL.brainSearch)).toBe(false)
        expect(isAbilityTool(TOOL.paymentMarkPaid)).toBe(false)
        expect(isAbilityTool("zalo.status")).toBe(false)
        expect(isChannelBound(TOOL.customerMessageSend)).toBe(true)
        expect(isChannelBound(TOOL.ledgerAppend)).toBe(false)
        expect(providerOfChannel("zalo")).toBe("zalo_oa")
        expect(providerOfChannel("telegram")).toBe("telegram")
        expect(providerOfChannel("facebook")).toBe("meta")
        expect(providerOfChannel("instagram")).toBe("meta")
        expect(providerOfChannel("website")).toBeNull()
    })
})

describe("judgeAbility: the decision table", () => {
    const off = { ability: "ledger.write", providers: ["google"] }

    it("not attached refuses", () => {
        expect(judgeAbility([], TOOL.ledgerAppend, false)).toEqual({ kind: "refuse", reason: "not_attached", ...off })
        expect(judgeAbility([row("sepay", { "qr.create": "auto" })], TOOL.ledgerAppend, true)).toEqual({
            kind: "refuse",
            reason: "not_attached",
            ...off,
        })
    })

    it("attached and unticked refuses", () => {
        expect(judgeAbility([row("google", { "ledger.read": "auto" })], TOOL.ledgerAppend, true)).toEqual({
            kind: "refuse",
            reason: "ability_off",
            ...off,
        })
    })

    it("ticked read allows", () => {
        expect(judgeAbility([row("google", { "ledger.read": "auto" })], TOOL.ledgerStatus, false)).toEqual({
            kind: "allow",
            provider: "google",
            ability: "ledger.read",
        })
    })

    it("ticked write auto allows", () => {
        expect(judgeAbility([row("google", { "ledger.write": "auto" })], TOOL.ledgerAppend, false)?.kind).toBe("allow")
    })

    it("ticked write ask waits for a person, and allows the call that person approved", () => {
        const rows = [row("google", { "ledger.write": "ask" })]
        expect(judgeAbility(rows, TOOL.ledgerAppend, false)).toEqual({
            kind: "approval",
            provider: "google",
            ability: "ledger.write",
        })
        expect(judgeAbility(rows, TOOL.ledgerAppend, true)?.kind).toBe("allow")
    })

    it("does not judge a tool that is no provider right (a default-granted brain read stays the grant policy's)", () => {
        expect(judgeAbility([], TOOL.brainSearch, false)).toBeNull()
        expect(judgeAbility([], TOOL.orderRecord, false)).toBeNull()
    })
})

describe("judgeAbility: customer.message.send on the conversation's channel", () => {
    const rows = [row("zalo_oa", { "customer.send": "auto" }), row("telegram", {}), row("sepay", { "qr.create": "auto" })]

    it("is not judged without the provider of the conversation's channel", () => {
        expect(judgeAbility(rows, TOOL.customerMessageSend, false)).toBeNull()
    })

    it("judges the ability on the channel's own provider, not on another the agent may send on", () => {
        expect(judgeAbility(rows, TOOL.customerMessageSend, false, "zalo_oa")?.kind).toBe("allow")
        expect(judgeAbility(rows, TOOL.customerMessageSend, false, "telegram")).toEqual({
            kind: "refuse",
            reason: "ability_off",
            ability: "customer.send",
            providers: ["telegram"],
        })
        expect(judgeAbility(rows, TOOL.customerMessageSend, false, "meta")).toMatchObject({
            kind: "refuse",
            reason: "not_attached",
            providers: ["meta"],
        })
    })
})

describe("ticks", () => {
    it("stores what a person asked: off is unticked, a read ability has no ask, an unknown ability or mode is refused", () => {
        const google = providerSpecOf("google") ?? PROVIDER_CATALOGUE[0]!
        expect(ticksOfWish(google, { "ledger.read": "ask", "ledger.write": "ask", "drive.read": "off" })).toEqual({
            ok: true,
            ticks: { "ledger.read": "auto", "ledger.write": "ask" },
        })
        expect(ticksOfWish(google, { "qr.create": "auto" })).toEqual({ ok: false, ability: "qr.create" })
        expect(ticksOfWish(google, { "ledger.write": "write" })).toEqual({ ok: false, ability: "ledger.write" })
    })

    it("gives the three seeded agents their core work by default, and nothing else", () => {
        expect(defaultsOf("chatbot")).toEqual({
            zalo_oa: { "customer.send": "auto" },
            telegram: { "customer.send": "auto" },
            meta: { "customer.send": "auto" },
        })
        expect(defaultsOf("sales")).toEqual({
            zalo_oa: { "customer.send": "auto" },
            telegram: { "customer.send": "auto" },
            meta: { "customer.send": "auto" },
            sepay: { "qr.create": "auto" },
        })
        expect(defaultsOf("accounting")).toEqual({
            zalo_oa: { "customer.send": "auto" },
            telegram: { "customer.send": "auto" },
            meta: { "customer.send": "auto" },
            sepay: { "transactions.read": "auto", "credit.rematch": "auto" },
            google: { "ledger.read": "auto", "ledger.write": "auto" },
        })
    })

    it("lets a provider's own entry replace its kind's, and proposes nothing to a module that names neither", () => {
        const zalo = providerSpecOf("zalo_oa") ?? PROVIDER_CATALOGUE[0]!
        const template = { kinds: { messaging: { "customer.send": "auto" } }, providers: { zalo_oa: { "customer.send": "ask" } } } as const
        expect(ticksOfTemplate(template, zalo)).toEqual({ "customer.send": "ask" })
        expect(ticksOfTemplate({ kinds: { payment: { "qr.create": "auto" } } }, zalo)).toBeNull()
        expect(ticksOfTemplate(undefined, zalo)).toBeNull()
    })
})
