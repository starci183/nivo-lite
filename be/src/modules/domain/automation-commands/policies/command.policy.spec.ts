import { commandIdOf } from "./command.policy"

describe("commandIdOf", () => {
    it("answers none for a payload that is not an object", () => {
        expect(commandIdOf("command")).toBeNull()
        expect(commandIdOf(3)).toBeNull()
        expect(commandIdOf(true)).toBeNull()
        expect(commandIdOf(undefined)).toBeNull()
    })

    it("answers none for a null payload", () => {
        expect(commandIdOf(null)).toBeNull()
    })

    it("answers none for an object without a command id", () => {
        expect(commandIdOf({})).toBeNull()
    })

    it("answers none for a command id that is not a string", () => {
        expect(commandIdOf({ commandId: 3 })).toBeNull()
    })

    it("answers none for a string that is not a uuid", () => {
        expect(commandIdOf({ commandId: "not-a-uuid" })).toBeNull()
    })

    it("answers a valid lower case uuid as it is", () => {
        expect(commandIdOf({ commandId: "a1b2c3d4-e5f6-4789-abcd-0123456789ab" })).toBe(
            "a1b2c3d4-e5f6-4789-abcd-0123456789ab",
        )
    })

    it("answers a valid upper case uuid as it is", () => {
        expect(commandIdOf({ commandId: "A1B2C3D4-E5F6-4789-ABCD-0123456789AB" })).toBe(
            "A1B2C3D4-E5F6-4789-ABCD-0123456789AB",
        )
    })
})
