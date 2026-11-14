import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { ProviderAttachmentView } from "@modules/domain/tool-grants"
import { OPENAPI_PROVIDER } from "@modules/domain/openapi-tools"
import { ABILITY_LABELS, KIND_LABELS, PROVIDER_LABELS } from "./messages/provider-abilities.labels"
import {
    PROVIDER_CATALOGUE,
    bindNodeProviders,
    holdsTool,
    isChannelBound,
    isProviderBound,
    isProviderParted,
    isProviderTool,
    judgeAttachment,
    pickAccountOf,
    providerOfChannel,
    providerSpecOf,
    providersHolding,
    providersOfDeclaration,
    unpickedOf,
} from "./provider-abilities.policy"
import { moduleProvidersOf } from "./agent-accounts.service"

const row = (provider: string, connectionId = `conn-${provider}`): ProviderAttachmentView => ({
    agentId: "a1",
    connectionId,
    provider,
})

describe("the provider catalogue: which provider serves which tool (information, not rights)", () => {
    it("names every provider, kind and tool group in both languages, and lists a tool once per provider", () => {
        for (const spec of PROVIDER_CATALOGUE.filter((entry) => entry.provider !== OPENAPI_PROVIDER)) {
            expect([spec.provider, Object.hasOwn(PROVIDER_LABELS, spec.provider)]).toEqual([spec.provider, true])
            expect([spec.kind, Object.hasOwn(KIND_LABELS, spec.kind)]).toEqual([spec.kind, true])
            expect(Object.keys(ABILITY_LABELS[spec.provider] ?? {}).sort()).toEqual(spec.abilities.map((ability) => ability.id).sort())
            const tools = spec.abilities.flatMap((ability) => ability.tools)
            expect(new Set(tools).size).toBe(tools.length)
        }
    })

    it("names the OpenAPI provider and gives it one group per declared operation, each holding exactly that tool", () => {
        const spec = providerSpecOf(OPENAPI_PROVIDER)

        expect([spec?.kind, Object.hasOwn(KIND_LABELS, "records"), Object.hasOwn(PROVIDER_LABELS, OPENAPI_PROVIDER)]).toEqual(["records", true, true])
        expect((spec?.abilities ?? []).every((ability) => ability.tools.length === 1 && ability.tools[0] === ability.id)).toBe(true)
    })

    it("knows a provider tool from NIVO's own tools, and the one tool whose provider only the conversation tells", () => {
        expect(isProviderTool(TOOL.ledgerEntryAppend)).toBe(true)
        expect(isProviderTool(TOOL.paymentCreditList)).toBe(true)
        expect(isProviderTool(TOOL.brainSearch)).toBe(false)
        expect(isProviderTool(TOOL.connectionStatusGet)).toBe(true)
        expect(isChannelBound(TOOL.customerMessageSend)).toBe(true)
        expect(isChannelBound(TOOL.ledgerEntryAppend)).toBe(false)
        expect(providerOfChannel("zalo")).toBe("zalo_oa")
        expect(providerOfChannel("telegram")).toBe("telegram")
        expect(providerOfChannel("facebook")).toBe("meta")
        expect(providerOfChannel("instagram")).toBe("meta")
        expect(providerOfChannel("website")).toBeNull()
    })

    it("keeps the SMTP account to its mail tool alone and the IMAP mailbox to its two reads", () => {
        expect(providerSpecOf("smtp")?.abilities).toEqual([{ id: "email.send", scope: "write", tools: [TOOL.mailMessageSend] }])
        expect(providerSpecOf("imap")?.abilities).toEqual([
            { id: "mail.read", scope: "read", tools: [TOOL.mailMessageList, TOOL.mailMessageGet] },
        ])
    })
})

describe("judgeAttachment: the kill switch (the attachment alone; the mode is the node's)", () => {
    it("not attached refuses not_attached, naming the providers that serve the tool", () => {
        expect(judgeAttachment([], TOOL.ledgerEntryAppend)).toEqual({ kind: "refuse", reason: "not_attached", providers: ["google"] })
        expect(judgeAttachment([row("sepay")], TOOL.ledgerEntryAppend)).toEqual({
            kind: "refuse",
            reason: "not_attached",
            providers: ["google"],
        })
    })

    it("attached allows a read and a write alike: the policy never asks", () => {
        for (const tool of [TOOL.ledgerStatusGet, TOOL.ledgerEntryAppend]) {
            expect(judgeAttachment([row("google")], tool)).toEqual({ kind: "allow", provider: "google", connectionId: "conn-google" })
        }
    })

    it("does not judge a tool no provider serves", () => {
        expect(judgeAttachment([], TOOL.brainSearch)).toBeNull()
        expect(judgeAttachment([], TOOL.agentTag)).toBeNull()
    })

    it("judges a call that names its account on that account alone; one that names none over every serving account", () => {
        const oa1 = row("zalo_oa", "oa-1")
        const oa2 = row("zalo_oa", "oa-2")
        const mb = row("sepay", "mb")
        const vcb = row("sepay", "vcb")
        const send = TOOL.customerMessageSend

        expect(judgeAttachment([oa1], send, { provider: "zalo_oa", connectionId: "oa-1" })).toMatchObject({ kind: "allow", connectionId: "oa-1" })
        expect(judgeAttachment([oa1], send, { provider: "zalo_oa", connectionId: "oa-2" })).toEqual({
            kind: "refuse",
            reason: "not_attached",
            providers: ["zalo_oa"],
            connectionId: "oa-2",
        })
        expect(judgeAttachment([oa1, oa2], send, { provider: "zalo_oa", connectionId: "oa-2" })).toMatchObject({ connectionId: "oa-2" })
        expect(judgeAttachment([mb, vcb], TOOL.bankTransactionList, { connectionId: "vcb" })).toMatchObject({ kind: "allow", connectionId: "vcb" })
        expect(judgeAttachment([oa1], TOOL.bankTransactionList, { connectionId: "oa-1" })).toMatchObject({ kind: "refuse", reason: "not_attached" })
        expect(judgeAttachment([oa1, vcb], TOOL.bankTransactionList)).toMatchObject({ kind: "allow", connectionId: "vcb" })
        expect([mb, vcb, oa1].filter((one) => holdsTool(one, TOOL.bankTransactionList)).map((one) => one.connectionId)).toEqual(["mb", "vcb"])
    })

    it("judges the customer send only on the conversation's own provider", () => {
        const rows = [row("zalo_oa"), row("telegram"), row("sepay")]

        expect(judgeAttachment(rows, TOOL.customerMessageSend)).toBeNull()
        expect(judgeAttachment(rows, TOOL.customerMessageSend, { provider: "telegram" })).toMatchObject({ kind: "allow", provider: "telegram" })
        expect(judgeAttachment(rows, TOOL.customerMessageSend, { provider: "meta" })).toMatchObject({
            kind: "refuse",
            reason: "not_attached",
            providers: ["meta"],
        })
    })

    it("judges a tool answered per provider part by part: no verdict with no provider named or on a provider that does not serve it", () => {
        expect(providersHolding(TOOL.connectionStatusGet)).toEqual(["sepay"])
        expect(isProviderParted(TOOL.connectionStatusGet)).toBe(true)
        expect(isProviderBound(TOOL.connectionStatusGet)).toBe(true)
        expect(isProviderBound(TOOL.customerMessageSend)).toBe(true)
        expect(isProviderBound(TOOL.paymentCreditList)).toBe(false)

        expect(judgeAttachment([], TOOL.connectionStatusGet)).toBeNull()
        expect(judgeAttachment([], TOOL.connectionStatusGet, { provider: "zalo_oa" })).toBeNull()
        expect(judgeAttachment([], TOOL.connectionStatusGet, { provider: "sepay" })).toMatchObject({ kind: "refuse", reason: "not_attached" })
        expect(judgeAttachment([row("sepay", "mb")], TOOL.connectionStatusGet, { provider: "sepay" })).toEqual({
            kind: "allow",
            provider: "sepay",
            connectionId: "mb",
        })
    })
})

describe("the providers a fresh agent is attached to", () => {
    it("are the providers the seeded chatbot and sales template agents list, in catalogue order of the kind they serve", () => {
        expect(moduleProvidersOf("chatbot")).toEqual(expect.arrayContaining(["zalo_oa", "telegram", "meta"]))
        expect([...moduleProvidersOf("sales")].sort()).toEqual(["casso", "meta", "payos", "sepay", "telegram", "zalo_oa"])
        expect(moduleProvidersOf("accounting")).not.toContain("imap")
    })

    it("read an old declaration only for which providers it names: a mode it wrote is nothing, `off` names nothing", () => {
        expect(providersOfDeclaration({ kinds: { messaging: { "customer.send": "ask" } } })).toEqual(["zalo_oa", "telegram", "meta"])
        expect(providersOfDeclaration({ providers: { smtp: { "email.send": "auto" } }, kinds: { payment: { "qr.create": "off" } } })).toEqual([
            "smtp",
        ])
        expect(providersOfDeclaration(undefined)).toEqual([])
    })
})

describe("which of several accounts of one provider a step's call uses (pickAccountOf)", () => {
    const live = { provider: "bank", connectionId: "live" }
    const sandbox = { provider: "bank", connectionId: "sandbox" }
    const both = [live, sandbox]

    it("binds nothing when the agent holds no account of the provider (the kill switch)", () => {
        expect(pickAccountOf([], null)).toEqual({ kind: "none" })
        expect(pickAccountOf([], "live", { triggerConnectionId: "live", usedConnectionIds: ["live"] })).toEqual({ kind: "none" })
    })

    it("binds the one account exactly as before, whatever the run or a default says", () => {
        expect(pickAccountOf([live], null)).toEqual({ kind: "picked", account: live, by: "only" })
        expect(pickAccountOf([live], "sandbox", { triggerConnectionId: "sandbox", usedConnectionIds: ["sandbox"] })).toEqual({
            kind: "picked",
            account: live,
            by: "only",
        })
    })

    it("(1) the account the run's trigger came in on wins over the run's earlier calls and the default", () => {
        expect(pickAccountOf(both, "live", { triggerConnectionId: "sandbox", usedConnectionIds: ["live"] })).toEqual({
            kind: "picked",
            account: sandbox,
            by: "trigger",
        })
    })

    it("(2) an account the run already used wins over the default, the most recent use first", () => {
        expect(pickAccountOf(both, "live", { usedConnectionIds: ["sandbox", "live"] })).toEqual({
            kind: "picked",
            account: sandbox,
            by: "run",
        })
        expect(pickAccountOf(both, "live", { triggerConnectionId: null, usedConnectionIds: ["elsewhere", "sandbox"] })).toEqual({
            kind: "picked",
            account: sandbox,
            by: "run",
        })
    })

    it("(3) the agent's default account decides when the run names none", () => {
        expect(pickAccountOf(both, "sandbox")).toEqual({ kind: "picked", account: sandbox, by: "default" })
        expect(pickAccountOf(both, "live", { usedConnectionIds: [] })).toEqual({ kind: "picked", account: live, by: "default" })
    })

    it("(4) names the choice to make when nothing picks: the candidates, never a guess", () => {
        expect(pickAccountOf(both, null)).toEqual({ kind: "needs_pick", candidates: both })
        expect(pickAccountOf(both, null, { triggerConnectionId: undefined, usedConnectionIds: [] })).toEqual({
            kind: "needs_pick",
            candidates: both,
        })
    })

    it("reads a fact that names an account outside the candidates as naming nothing", () => {
        expect(pickAccountOf(both, "gone", { triggerConnectionId: "gone", usedConnectionIds: ["gone"] })).toEqual({
            kind: "needs_pick",
            candidates: both,
        })
        expect(pickAccountOf(both, "gone", { triggerConnectionId: "gone", usedConnectionIds: ["sandbox"] })).toEqual({
            kind: "picked",
            account: sandbox,
            by: "run",
        })
    })
})

describe("the binding of a node's providers (bindNodeProviders, unpickedOf)", () => {
    const live = { provider: "bank", connectionId: "live" }
    const sandbox = { provider: "bank", connectionId: "sandbox" }
    const mail = { provider: "mail", connectionId: "mail-1" }
    const none = (): null => null

    it("binds, in the node's order, each provider's one account; a provider with none binds nothing", () => {
        expect(bindNodeProviders(["mail", "bank", "mail", "chat"], [live, mail], none)).toEqual([mail, live])
    })

    it("of several accounts of one provider binds the one the order picks, and nothing when none is picked", () => {
        expect(bindNodeProviders(["bank"], [live, sandbox], none)).toEqual([])
        expect(bindNodeProviders(["bank"], [live, sandbox], () => "sandbox")).toEqual([sandbox])
        expect(bindNodeProviders(["bank"], [live, sandbox], () => "live", { triggerConnectionId: "sandbox" })).toEqual([sandbox])
        expect(bindNodeProviders(["bank", "mail"], [live, sandbox, mail], none, { usedConnectionIds: ["live"] })).toEqual([live, mail])
    })

    it("lists the providers still to pick, in the node's order, with their candidate accounts", () => {
        expect(unpickedOf(["mail", "bank"], [live, sandbox, mail], none)).toEqual([{ provider: "bank", connectionIds: ["live", "sandbox"] }])
        expect(unpickedOf(["bank"], [live, sandbox], () => "live")).toEqual([])
        expect(unpickedOf(["bank"], [live], none)).toEqual([])
        expect(unpickedOf(["bank"], [live, sandbox], none, { triggerConnectionId: "live" })).toEqual([])
    })
})
