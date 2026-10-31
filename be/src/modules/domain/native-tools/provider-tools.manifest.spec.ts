import { providerTools } from "./provider-tools.manifest"

describe("providerTools", () => {
    it("gives a channel a status and an events tool, both read, auto and for internal use only", () => {
        const tools = providerTools("Telegram", true)

        expect(tools.map((tool) => [tool.name, tool.scope, tool.defaultMode, tool.internalOnly])).toEqual([
            ["status", "read", "auto", true],
            ["events", "read", "auto", true],
        ])
        expect(tools[0]?.description).toContain("Telegram")
        expect(tools[1]?.secretFields).toEqual(["customerMasked"])
        expect(tools[1]?.inputSchema).toMatchObject({ required: ["connectionId"], additionalProperties: false })
    })

    it("gives a provider that is no channel a status tool alone", () => {
        expect(providerTools("SePay", false).map((tool) => tool.name)).toEqual(["status"])
    })
})
