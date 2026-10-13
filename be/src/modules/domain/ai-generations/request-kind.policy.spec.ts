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
})
