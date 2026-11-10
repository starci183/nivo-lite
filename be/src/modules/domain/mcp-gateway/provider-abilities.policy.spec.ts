import { MODULE_DECLARATIONS } from "@nivo-lite/blocks-core/modules"
import { TOOL } from "@nivo-lite/blocks-core"
import type { ProviderAttachmentView } from "@modules/domain/mcp-tool-grants"
import { ABILITY_LABELS, KIND_LABELS, PROVIDER_LABELS } from "./messages/provider-abilities.labels"
import {
    PROVIDER_CATALOGUE,
    accountsHolding,
    defaultAccountKindOf,
    cappedTicks,
    exceedsCeiling,
    isAbilityTool,
    isChannelBound,
    judgeAbility,
    providerOfChannel,
    providerSpecOf,
    ticksOfTemplate,
    ticksOfWish,
} from "./provider-abilities.policy"

const row = (
    provider: string,
    abilities: ProviderAttachmentView["abilities"],
    connectionId = `conn-${provider}`,
): ProviderAttachmentView => ({ agentId: "a1", connectionId, provider, abilities })

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
        expect(isAbilityTool("zalo.status.get")).toBe(false)
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
            connectionId: "conn-google",
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
            connectionId: "conn-google",
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

describe("judgeAbility: nivo.lead.message.send on the conversation's channel", () => {
    const rows = [row("zalo_oa", { "customer.send": "auto" }), row("telegram", {}), row("sepay", { "qr.create": "auto" })]

    it("is not judged without the provider of the conversation's channel", () => {
        expect(judgeAbility(rows, TOOL.customerMessageSend, false)).toBeNull()
    })

    it("judges the ability on the channel's own provider, not on another the agent may send on", () => {
        expect(judgeAbility(rows, TOOL.customerMessageSend, false, { provider: "zalo_oa" })?.kind).toBe("allow")
        expect(judgeAbility(rows, TOOL.customerMessageSend, false, { provider: "telegram" })).toEqual({
            kind: "refuse",
            reason: "ability_off",
            ability: "customer.send",
            providers: ["telegram"],
        })
        expect(judgeAbility(rows, TOOL.customerMessageSend, false, { provider: "meta" })).toMatchObject({
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

    it("knows what only the owner may give: a write ability on auto; capped, it asks, and a read ability stays ticked", () => {
        const sepay = providerSpecOf("sepay") ?? PROVIDER_CATALOGUE[0]!
        const ticks = { "transactions.read": "auto", "qr.create": "auto", "credit.rematch": "ask" } as const
        expect(exceedsCeiling(sepay, ticks)).toBe(true)
        expect(exceedsCeiling(sepay, { "transactions.read": "auto", "credit.rematch": "ask" })).toBe(false)
        expect(cappedTicks(sepay, ticks)).toEqual({ "transactions.read": "auto", "qr.create": "ask", "credit.rematch": "ask" })
    })

    it("lets a provider's own entry replace its kind's, and proposes nothing to a module that names neither", () => {
        const zalo = providerSpecOf("zalo_oa") ?? PROVIDER_CATALOGUE[0]!
        const template = { kinds: { messaging: { "customer.send": "auto" } }, providers: { zalo_oa: { "customer.send": "ask" } } } as const
        expect(ticksOfTemplate(template, zalo)).toEqual({ "customer.send": "ask" })
        expect(ticksOfTemplate({ kinds: { payment: { "qr.create": "auto" } } }, zalo)).toBeNull()
        expect(ticksOfTemplate(undefined, zalo)).toBeNull()
    })
})

describe("judgeAbility: per connected account", () => {
    const oa1 = row("zalo_oa", { "customer.send": "auto" }, "oa-1")
    const oa2 = row("zalo_oa", { "customer.send": "ask" }, "oa-2")
    const mb = row("sepay", { "transactions.read": "auto" }, "mb")
    const vcb = row("sepay", { "transactions.read": "auto", "qr.create": "auto" }, "vcb")

    it("judges a call that names its account on that account alone: attached to another account of the provider is not attached", () => {
        const send = TOOL.customerMessageSend
        expect(judgeAbility([oa1], send, false, { provider: "zalo_oa", connectionId: "oa-1" })).toMatchObject({ kind: "allow", connectionId: "oa-1" })
        expect(judgeAbility([oa1], send, false, { provider: "zalo_oa", connectionId: "oa-2" })).toEqual({
            kind: "refuse",
            reason: "not_attached",
            ability: "customer.send",
            providers: ["zalo_oa"],
            connectionId: "oa-2",
        })
        expect(judgeAbility([oa1, oa2], send, false, { provider: "zalo_oa", connectionId: "oa-2" })).toMatchObject({
            kind: "approval",
            connectionId: "oa-2",
        })
        expect(judgeAbility([mb, vcb], TOOL.paymentQrCreate, false, { connectionId: "mb" })).toMatchObject({
            kind: "refuse",
            reason: "ability_off",
            connectionId: "mb",
        })
        expect(judgeAbility([mb, vcb], TOOL.paymentQrCreate, false, { connectionId: "vcb" })).toMatchObject({ kind: "allow" })
    })

    it("judges a call that names no account over every account of the provider, and tells which accounts hold the tool", () => {
        expect(judgeAbility([mb, vcb], TOOL.bankTransactions, false)).toMatchObject({ kind: "allow" })
        expect(judgeAbility([row("sepay", {}, "mb"), vcb], TOOL.bankTransactions, false)).toMatchObject({ kind: "allow", connectionId: "vcb" })
        expect(judgeAbility([row("sepay", {}, "mb")], TOOL.bankTransactions, false)).toMatchObject({ reason: "ability_off" })
        expect(accountsHolding([mb, vcb, oa1], TOOL.bankTransactions)).toEqual(["mb", "vcb"])
        expect(accountsHolding([mb, vcb], TOOL.paymentQrCreate)).toEqual(["vcb"])
    })

    it("names the kind whose default account a tool acts on: the payment QR, and no other tool", () => {
        expect(defaultAccountKindOf(TOOL.paymentQrCreate)).toBe("payment")
        expect(defaultAccountKindOf(TOOL.paymentRematch)).toBeNull()
        expect(defaultAccountKindOf(TOOL.customerMessageSend)).toBeNull()
        expect(defaultAccountKindOf(TOOL.ledgerAppend)).toBeNull()
    })
})
