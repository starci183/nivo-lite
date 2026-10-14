import { isRequestableKind } from "./request-kind.policy"

describe("isRequestableKind", () => {
    it.each([
        ["office", "relay", true],
        ["sales", "engine", true],
        ["setup", "setup", true],
        ["other", "guide", false],
        ["office", "guide", false],
        ["sales", "owner_chat", false],
        ["unknown", "engine", false],
        ["constructor", "engine", false],
    ])("module %s asking for kind %s -> %s", (module, kind, expected) => {
        expect(isRequestableKind(module, kind)).toBe(expected)
    })

    it.each([
        ["accounting", "engine"],
        ["booking", "engine"],
        ["brain", "brain"],
        ["chatbot", "engine"],
        ["chatbot", "chat_reply"],
        ["content", "engine"],
        ["hiring", "engine"],
        ["inventory", "engine"],
        ["knowledge", "engine"],
        ["leadgen", "engine"],
        ["loyalty", "engine"],
        ["office", "owner_chat"],
        ["office", "office_command"],
        ["other", "engine"],
        ["shifts", "engine"],
        ["video", "engine"],
    ])("allows module %s to request its own kind %s", (module, kind) => {
        expect(isRequestableKind(module, kind)).toBe(true)
    })

    it.each([
        ["toString", "engine"],
        ["__proto__", "engine"],
        ["brain", "engine"],
        ["setup", "engine"],
        ["office", "chat_reply"],
        ["chatbot", "relay"],
        ["other", ""],
    ])("refuses module %s asking for foreign or absent kind %s", (module, kind) => {
        expect(isRequestableKind(module, kind)).toBe(false)
    })
})
