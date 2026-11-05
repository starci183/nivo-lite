import { DOOR_PORT_ID, doorPort, doorToolSchema, isDomainTool, isDoorTool } from "./door-port"

describe("doorPort", () => {
    it("is the engine.door port", () => {
        expect(doorPort).toEqual({ entry: "port", id: DOOR_PORT_ID })
        expect(DOOR_PORT_ID).toBe("engine.door")
    })
})

describe("door tool names", () => {
    it("accepts <group>.<action> and <group>.<provider>.<action>", () => {
        for (const tool of [
            "chat.send",
            "ledger.append",
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
        expect(isDomainTool("chat.send")).toBe(true)
        expect(isDomainTool("ledger.append")).toBe(true)
        expect(isDomainTool("chat.zalo.send")).toBe(false)
        expect(isDomainTool("send")).toBe(false)
    })
})
