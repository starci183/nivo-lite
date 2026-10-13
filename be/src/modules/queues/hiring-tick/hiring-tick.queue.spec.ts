import { HIRING_TICK_QUEUE, isHiringTickPayload } from "./hiring-tick.queue"

describe("HIRING_TICK_QUEUE", () => {
    it("names the database queue used by the hiring processor", () => {
        expect(HIRING_TICK_QUEUE).toBe("hiring_tick")
    })
})

describe("isHiringTickPayload", () => {
    it.each([
        { name: "a workspace", payload: { workspaceId: "ws-1" } },
        { name: "an empty workspace id", payload: { workspaceId: "" } },
        { name: "additional fields", payload: { workspaceId: "ws-1", attempt: 2 } },
        { name: "an array with a workspace id", payload: Object.assign([], { workspaceId: "ws-1" }) },
    ])("accepts $name", ({ payload }) => {
        expect(isHiringTickPayload(payload)).toBe(true)
    })

    it.each([
        { name: "undefined", payload: undefined },
        { name: "null", payload: null },
        { name: "a string", payload: "ws-1" },
        { name: "a number", payload: 1 },
        { name: "a boolean", payload: true },
        { name: "a function", payload: () => ({ workspaceId: "ws-1" }) },
        { name: "an empty array", payload: [] },
        { name: "an empty object", payload: {} },
        { name: "a foreign payload", payload: { commandId: "command-1" } },
        { name: "a null workspace id", payload: { workspaceId: null } },
        { name: "an undefined workspace id", payload: { workspaceId: undefined } },
        { name: "a numeric workspace id", payload: { workspaceId: 1 } },
        { name: "an object workspace id", payload: { workspaceId: {} } },
    ])("refuses $name", ({ payload }) => {
        expect(isHiringTickPayload(payload)).toBe(false)
    })
})
