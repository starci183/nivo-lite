import { Test } from "@nestjs/testing"
import { triggersOf } from "@modules/domain/provider-triggers"
import type { ProviderTriggerDeclaration, TriggerSwitchView } from "@modules/domain/provider-triggers"
import { bankFiguresOf } from "./account-info.policy"
import { rightsOf, sampleParamsOf, triggerConfigsOf } from "./provider-registry.policy"

const SUBJECT = Symbol("provider-registry.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { rightsOf, sampleParamsOf, triggerConfigsOf } }],
    }).compile()
    return moduleRef.get<typeof import("./provider-registry.policy")>(SUBJECT)
}

const declared = (provider: string, name: string): ProviderTriggerDeclaration => {
    const found = triggersOf(provider).find((entry) => entry.name === name)
    if (found === undefined) throw new Error(`no trigger ${provider}:${name}`)
    return found
}

const BANK = declared("sepay", "transaction.received")
const MAIL = declared("imap", "mail.received")

const held = (change: Partial<TriggerSwitchView> = {}): TriggerSwitchView => ({
    name: "transaction.received",
    enabled: true,
    enabledAt: "2026-11-12T03:00:00.000Z",
    lastFiredAt: null,
    firedCount: 0,
    deciderAgentId: null,
    ...change,
})

describe("the trigger configuration of an account", () => {
    it("names the core agent as the one that decides, and says the owner cannot bind another while it is bound", async () => {
        const policy = await build()
        const [row] = policy.triggerConfigsOf([BANK], [held({ deciderAgentId: "plugin" })], { "transaction.received": "core" })
        expect(row).toMatchObject({ decided: true, coreDeciderAgentId: "core", decidingAgentId: "core", canCatchUp: true })
    })

    it("names the bound agent where no core agent is, and nobody on a trigger nobody decides on", async () => {
        const policy = await build()
        const [bank] = policy.triggerConfigsOf([BANK], [held({ deciderAgentId: "plugin" })], {})
        const [mail] = policy.triggerConfigsOf([MAIL], [held({ name: "mail.received" })], {})
        expect(bank?.decidingAgentId).toBe("plugin")
        expect(mail).toMatchObject({ decided: false, decidingAgentId: null, canCatchUp: true })
    })
})

describe("the rights on an account", () => {
    const facts = {
        agents: [
            { id: "a-core", name: "Accounting" },
            { id: "a-out", name: "Sales" },
            { id: "a-plugin", name: "Web books" },
        ],
        abilities: [
            { id: "transactions.read", tools: ["nivo.tool.bank.transaction.list"] },
            { id: "qr.create", tools: ["nivo.tool.payment.transfer.create"] },
        ],
        attached: new Set(["a-core", "a-plugin"]),
        registered: new Map([
            ["a-core", ["transaction.received"]],
            ["a-plugin", ["transaction.received"]],
            ["a-out", ["transaction.received"]],
        ]),
        deciders: { "transaction.received": "a-core" },
    }

    it("lists the attached agents first, every tool of the provider reachable by an attached agent, and the agent's part in each trigger", async () => {
        const policy = await build()
        const rows = policy.rightsOf(facts)

        expect(rows.map((row) => [row.agentId, row.attached])).toEqual([
            ["a-core", true],
            ["a-plugin", true],
            ["a-out", false],
        ])
        expect(rows[0]?.abilities).toEqual([
            { id: "transactions.read", tools: ["nivo.tool.bank.transaction.list"], allowed: true },
            { id: "qr.create", tools: ["nivo.tool.payment.transfer.create"], allowed: true },
        ])
        expect(rows[1]?.abilities.map((ability) => [ability.id, ability.allowed])).toEqual([
            ["transactions.read", true],
            ["qr.create", true],
        ])
        expect(rows[0]?.triggers).toEqual([{ name: "transaction.received", role: "decider" }])
        expect(rows[1]?.triggers).toEqual([{ name: "transaction.received", role: "notice" }])
    })

    it("gives an agent that is not attached nothing: no tool, and no trigger even when a workflow of it registered", async () => {
        const policy = await build()
        const [, , outsider] = policy.rightsOf(facts)
        expect(outsider?.abilities.every((ability) => !ability.allowed)).toBe(true)
        expect(outsider?.triggers).toEqual([])
    })

    it("names at most one decider of a trigger among the agents", async () => {
        const policy = await build()
        const deciders = policy.rightsOf(facts).flatMap((row) => row.triggers.filter((trigger) => trigger.role === "decider"))
        expect(deciders).toHaveLength(1)
    })
})

describe("the sample wakes of a trigger", () => {
    it("cover every filterable choice of a bank movement, and are one for a mailbox sync", async () => {
        const policy = await build()
        // Ledger (ROAD Opus-1f, R44): a sample is the event's generic scope; its payload is `data`, as a registration reads it.
        expect(policy.sampleParamsOf(BANK)).toEqual([
            { data: { transactionId: "sample", direction: "in" } },
            { data: { transactionId: "sample", direction: "out" } },
        ])
        expect(policy.sampleParamsOf(MAIL)).toEqual([{ eventIds: ["sample"], count: 1 }])
    })
})

describe("the figures of a bank account", () => {
    const record = { id: "c-1", status: "connected", lastError: null, lastEventAt: "2026-11-12T07:00:00.000Z", meta: { account_masked: "**** 9999" } }

    it("draws the account, how many transactions NIVO holds of it and the last one", () => {
        const figures = bankFiguresOf(record, 3)
        expect(figures.map((figure) => [figure.key, figure.value, figure.kind])).toEqual([
            ["account", "**** 9999", "text"],
            ["transactions_received", 3, "count"],
            ["last_received", "2026-11-12T07:00:00.000Z", "time"],
        ])
    })

    it("draws no number it does not have", () => {
        expect(bankFiguresOf(record).filter((figure) => figure.kind === "count").map((figure) => figure.value)).toEqual([null])
    })
})
