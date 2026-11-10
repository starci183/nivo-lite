import type { ProviderSpec } from "@modules/domain/mcp-gateway"
import { agentToolsOf } from "./agent-tools.policy"
import type { AgentToolsInput, ToolWords } from "./agent-tools.policy"

const CATALOGUE: ReadonlyArray<ProviderSpec> = [
    {
        provider: "zalo_oa",
        kind: "messaging",
        abilities: [{ id: "customer.send", scope: "write", tools: ["customer.message.send"], channels: ["zalo"] }],
    },
    {
        provider: "sepay",
        kind: "payment",
        abilities: [
            { id: "transactions.read", scope: "read", tools: ["bank.transactions", "sepay.status"] },
            { id: "qr.create", scope: "write", tools: ["payment.qr.create"], account: "default" },
        ],
    },
]

const WORDS: Readonly<Record<string, ToolWords>> = {
    "customer.message.send": {
        kind: "acts",
        title: { vi: "Nhắn khách", en: "Message a customer" },
        summary: { vi: "Trả lời khách.", en: "Replies to a customer." },
    },
    "brain.search": {
        kind: "reads",
        title: { vi: "Tra cứu", en: "Search" },
        summary: { vi: "Tìm.", en: "Searches." },
    },
}

const input = (overrides: Partial<AgentToolsInput> = {}): AgentToolsInput => ({
    declared: ["customer.message.send", "payment.qr.create", "brain.search", "order.create"],
    defaultReads: ["nivo.lead.profile.get", "brain.search"],
    attachments: [
        { agentId: "a-1", connectionId: "oa-1", provider: "zalo_oa", abilities: { "customer.send": "auto" } },
        { agentId: "a-1", connectionId: "mb", provider: "sepay", abilities: { "qr.create": "ask", "transactions.read": "auto" } },
    ],
    accountLabels: new Map([
        ["oa-1", "Tiệm hoa NIVO"],
        ["mb", "MB Bank •••• 5252"],
    ]),
    grants: [],
    catalogue: CATALOGUE,
    wordsOf: (tool) => WORDS[tool] ?? null,
    ...overrides,
})

describe("agentToolsOf", () => {
    it("lists the declared set, then the tools ticked abilities add, then the default reads, each once", () => {
        const tools = agentToolsOf(input())

        expect(tools.map((tool) => [tool.id, tool.origin])).toEqual([
            ["customer.message.send", "declared"],
            ["payment.qr.create", "declared"],
            ["brain.search", "declared"],
            ["order.create", "declared"],
            ["bank.transactions", "ability"],
            ["sepay.status", "ability"],
            ["nivo.lead.profile.get", "default-read"],
        ])
    })

    it("names each provider tool's accounts with their label and mode", () => {
        const tools = agentToolsOf(input())

        expect(tools.find((tool) => tool.id === "payment.qr.create")?.accounts).toEqual([
            { connectionId: "mb", provider: "sepay", accountLabel: "MB Bank •••• 5252", ability: "qr.create", mode: "ask" },
        ])
        expect(tools.find((tool) => tool.id === "customer.message.send")?.accounts).toEqual([
            { connectionId: "oa-1", provider: "zalo_oa", accountLabel: "Tiệm hoa NIVO", ability: "customer.send", mode: "auto" },
        ])
        expect(tools.find((tool) => tool.id === "order.create")?.accounts).toEqual([])
    })

    it("words a tool from the label file and shows an unnamed one by its id as an action", () => {
        const tools = agentToolsOf(input())

        expect(tools.find((tool) => tool.id === "brain.search")).toMatchObject({
            kind: "reads",
            title: { vi: "Tra cứu", en: "Search" },
        })
        expect(tools.find((tool) => tool.id === "order.create")).toMatchObject({
            kind: "acts",
            title: { vi: "order.create", en: "order.create" },
            summary: { vi: "", en: "" },
        })
    })

    it("is not ready for a provider tool no attached account ticks, but a send is (website chat)", () => {
        const tools = agentToolsOf(input({ attachments: [] }))

        expect(tools.find((tool) => tool.id === "payment.qr.create")?.ready).toBe(false)
        expect(tools.find((tool) => tool.id === "customer.message.send")?.ready).toBe(true)
        expect(tools.find((tool) => tool.id === "order.create")?.ready).toBe(true)
    })

    it("shows the owner's restricting row, its own before its connector's, and a forbidden tool is not ready", () => {
        const tools = agentToolsOf(
            input({
                grants: [
                    { tool: "brain.*", mode: "never" },
                    { tool: "nivo.lead.profile.get", mode: "ask" },
                    { tool: "order.create", mode: "auto" },
                    { tool: "brain.search", mode: "ask" },
                ],
            }),
        )

        expect(tools.find((tool) => tool.id === "brain.search")).toMatchObject({ grant: "ask", ready: true })
        expect(tools.find((tool) => tool.id === "nivo.lead.profile.get")).toMatchObject({ grant: "ask", ready: true })
        expect(tools.find((tool) => tool.id === "order.create")).toMatchObject({ grant: null, ready: true })
        expect(agentToolsOf(input({ grants: [{ tool: "brain.*", mode: "never" }] })).find((tool) => tool.id === "brain.search"))
            .toMatchObject({ grant: "never", ready: false })
    })
})
