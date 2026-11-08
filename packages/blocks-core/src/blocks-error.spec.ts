import { BlocksError } from "./blocks-error"

describe("BlocksError", () => {
    it("carries its code, what it is about and the message made of both", () => {
        const cause = new Error("root")
        const error = new BlocksError("FAKE_ENGINE_UNSUPPORTED", "write", { cause })

        expect(error.code).toBe("FAKE_ENGINE_UNSUPPORTED")
        expect(error.at).toBe("write")
        expect(error.message).toBe("FAKE_ENGINE_UNSUPPORTED: write")
        expect(error.name).toBe("BlocksError")
        expect(error.cause).toBe(cause)
    })
})
