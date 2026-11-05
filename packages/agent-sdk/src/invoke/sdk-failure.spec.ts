import { SdkError } from "../sdk-error"
import { sdkFailureOf } from "./sdk-failure"

describe("sdkFailureOf", () => {
    it("reads the code and subject of an SDK error", () => {
        expect(sdkFailureOf(new SdkError("SOME_CODE", "some.id"))).toEqual({ code: "SOME_CODE", at: "some.id" })
    })

    it("is undefined for any other value", () => {
        expect(sdkFailureOf(new Error("bug"))).toBeUndefined()
        expect(sdkFailureOf("text")).toBeUndefined()
    })
})
