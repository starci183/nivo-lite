import { DOOR_PORT_ID, doorPort, doorToolSchema, isDoorTool } from "./door-port"

describe("doorPort", () => {
    it("is the engine.door port", () => {
        expect(doorPort).toEqual({ entry: "port", id: DOOR_PORT_ID })
        expect(DOOR_PORT_ID).toBe("engine.door")
    })
})

describe("door tool names", () => {
    it("accepts <group>.<provider>.<action>", () => {
        for (const tool of ["chat.zalo.send", "accounting.ledger.append", "accounting.ledger.voidEntry"]) {
            expect(isDoorTool(tool)).toBe(true)
            expect(doorToolSchema.safeParse(tool).success).toBe(true)
        }
    })

    it("refuses fewer or more parts, upper case groups and an overlong name", () => {
        for (const tool of [
            "chat.send",
            "chat.zalo.send.now",
            "Chat.zalo.send",
            "chat..send",
            `chat.zalo.${"a".repeat(120)}`,
        ]) {
            expect(isDoorTool(tool)).toBe(false)
        }
    })
})
