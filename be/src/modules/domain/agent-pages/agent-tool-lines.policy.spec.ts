import type { ProviderSpec } from "@modules/domain/tools"
import { agentToolsOf } from "./agent-tool-lines.policy"
import type { AgentToolsInput, ToolWords } from "./agent-tool-lines.policy"

const CATALOGUE: ReadonlyArray<ProviderSpec> = [
    {
        provider: "zalo_oa",
        kind: "messaging",
        abilities: [{ id: "customer.send", scope: "write", tools: ["nivo.tool.customer.message.send"], channels: ["zalo"] }],
    },
    {
        provider: "sepay",
        kind: "payment",
        abilities: [
            { id: "transactions.read", scope: "read", tools: ["nivo.tool.bank.transaction.list", "nivo.tool.connection.status.get"] },
            { id: "qr.create", scope: "write", tools: ["nivo.tool.payment.transfer.create"] },
        ],
    },
]

const WORDS: Readonly<Record<string, ToolWords>> = {
    "nivo.tool.customer.message.send": {
        kind: "acts",
        title: { vi: "Nh\u1eafn kh\u00e1ch", en: "Message a customer" },
        summary: { vi: "Tr\u1ea3 l\u1eddi kh\u00e1ch.", en: "Replies to a customer." },
    },
    "nivo.tool.brain.search": {
        kind: "reads",
        title: { vi: "Tra c\u1ee9u", en: "Search" },
        summary: { vi: "T\u00ecm.", en: "Searches." },
    },
}

const input = (overrides: Partial<AgentToolsInput> = {}): AgentToolsInput => ({
    declared: ["nivo.tool.customer.message.send", "nivo.tool.payment.transfer.create", "nivo.tool.brain.search", "nivo.tool.order.create"],
    defaultReads: ["nivo.tool.contact.get", "nivo.tool.brain.search"],
    attachments: [
        { agentId: "a-1", connectionId: "oa-1", provider: "zalo_oa" },
        { agentId: "a-1", connectionId: "mb", provider: "sepay" },
    ],
    accountLabels: new Map([
        ["oa-1", "Ti\u1ec7m hoa NIVO"],
        ["mb", "MB Bank \u2022\u2022\u2022\u2022 5252"],
    ]),
    grants: [],
    catalogue: CATALOGUE,
    wordsOf: (tool) => WORDS[tool] ?? null,
    ...overrides,
})

describe("agentToolsOf", () => {
    it("lists the declared set, then the tools the attached accounts serve, then the default reads, each once", () => {
        const tools = agentToolsOf(input())

        expect(tools.map((tool) => [tool.id, tool.origin])).toEqual([
            ["nivo.tool.customer.message.send", "declared"],
            ["nivo.tool.payment.transfer.create", "declared"],
            ["nivo.tool.brain.search", "declared"],
            ["nivo.tool.order.create", "declared"],
            ["nivo.tool.bank.transaction.list", "attached"],
            ["nivo.tool.connection.status.get", "attached"],
            ["nivo.tool.contact.get", "default-read"],
        ])
    })

    it("names each provider tool's attached accounts with their label", () => {
        const tools = agentToolsOf(input())

        expect(tools.find((tool) => tool.id === "nivo.tool.payment.transfer.create")?.accounts).toEqual([
            { connectionId: "mb", provider: "sepay", accountLabel: "MB Bank \u2022\u2022\u2022\u2022 5252" },
        ])
        expect(tools.find((tool) => tool.id === "nivo.tool.customer.message.send")?.accounts).toEqual([
            { connectionId: "oa-1", provider: "zalo_oa", accountLabel: "Ti\u1ec7m hoa NIVO" },
        ])
        expect(tools.find((tool) => tool.id === "nivo.tool.order.create")?.accounts).toEqual([])
    })

    it("words a tool from the label file and shows an unnamed one by its id as an action", () => {
        const tools = agentToolsOf(input())

        expect(tools.find((tool) => tool.id === "nivo.tool.brain.search")).toMatchObject({
            kind: "reads",
            title: { vi: "Tra c\u1ee9u", en: "Search" },
        })
        expect(tools.find((tool) => tool.id === "nivo.tool.order.create")).toMatchObject({
            kind: "acts",
            title: { vi: "nivo.tool.order.create", en: "nivo.tool.order.create" },
            summary: { vi: "", en: "" },
        })
    })

    it("is not ready for a provider tool no attached account serves, but a send is (website chat)", () => {
        const tools = agentToolsOf(input({ attachments: [] }))

        expect(tools.find((tool) => tool.id === "nivo.tool.payment.transfer.create")?.ready).toBe(false)
        expect(tools.find((tool) => tool.id === "nivo.tool.customer.message.send")?.ready).toBe(true)
        expect(tools.find((tool) => tool.id === "nivo.tool.order.create")?.ready).toBe(true)
    })

    it("shows the owner's restricting row, its own before its connector's", () => {
        const tools = agentToolsOf(
            input({
                grants: [
                    { tool: "nivo.tool.brain.*", mode: "auto" },
                    { tool: "nivo.tool.contact.get", mode: "ask" },
                    { tool: "nivo.tool.order.create", mode: "auto" },
                    { tool: "nivo.tool.brain.search", mode: "ask" },
                ],
            }),
        )

        expect(tools.find((tool) => tool.id === "nivo.tool.brain.search")).toMatchObject({ grant: "ask", ready: true })
        expect(tools.find((tool) => tool.id === "nivo.tool.contact.get")).toMatchObject({ grant: "ask", ready: true })
        expect(tools.find((tool) => tool.id === "nivo.tool.order.create")).toMatchObject({ grant: null, ready: true })
    })
})
