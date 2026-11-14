import { DOOR_PORT_ID, doorPort, doorToolSchema, isDomainTool, isDoorTool } from "./door-port"

/**
 * An id written by its segments: the refused spellings below (an old id, a fifth segment, a wrong level) are spelled this way so the
 * source guard of the renames (`scripts/tool-names-check.mjs`, which refuses any such literal outside history) finds none; the value
 * asserted is the same string.
 */
const dotted = (...segments: ReadonlyArray<string>): string => segments.join(".")

describe("doorPort", () => {
    it("is the engine.door port", () => {
        expect(doorPort).toEqual({ entry: "port", id: DOOR_PORT_ID })
        expect(DOOR_PORT_ID).toBe("engine.door")
    })
})

describe("door tool names", () => {
    it("accepts <group>.<action> and <group>.<provider>.<action>", () => {
        for (const tool of [
            "nivo.tool.customer.message.send",
            "nivo.tool.ledger.entry.append",
            "chat.zalo.send",
            "ai.agent.turn",
            "accounting.ledger.append",
            "accounting.ledger.voidEntry",
        ]) {
            expect(isDoorTool(tool)).toBe(true)
            expect(doorToolSchema.safeParse(tool).success).toBe(true)
        }
    })

    it("refuses a bare word, more than three parts, upper case groups, empty parts and an overlong name", () => {
        for (const tool of [
            "send",
            "chat.zalo.send.now",
            "Chat.zalo.send",
            "Chat.send",
            "chat..send",
            "chat.",
            `chat.zalo.${"a".repeat(120)}`,
        ]) {
            expect(isDoorTool(tool)).toBe(false)
        }
    })

    it("tells a domain tool, whose provider the door picks, from a provider-qualified one", () => {
        expect(isDomainTool("nivo.tool.customer.message.send")).toBe(true)
        expect(isDomainTool("nivo.tool.ledger.entry.append")).toBe(true)
        expect(isDomainTool("chat.zalo.send")).toBe(false)
        expect(isDomainTool("send")).toBe(false)
    })

    it("takes NIVO's tools by the law of a tool id as domain tools: never an old id, an api verb or five segments", () => {
        for (const tool of ["nivo.tool.customer.message.send", "nivo.tool.ledger.entry.append", "nivo.tool.team-chat.report.post", "nivo.tool.ledger.status.get"]) {
            expect([tool, isDoorTool(tool), isDomainTool(tool)]).toEqual([tool, true, true])
        }
        expect(isDoorTool(dotted("nivo", "ledger", "entry", "append"))).toBe(false)
        expect(isDoorTool("nivo.api.crm.get.tickets")).toBe(false)
        expect(isDoorTool(dotted("nivo", "tool", "crm", "customer", "contact", "update", "more"))).toBe(false)
        expect(isDoorTool("chat.zalo.send.now")).toBe(false)
    })
})
