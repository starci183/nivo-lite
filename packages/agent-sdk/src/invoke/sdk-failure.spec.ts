import { DomainError } from "@starci/common"
import { NodeRunError } from "../node/node-run-error"
import { JobRefused } from "../mutation/job-door"
import { JobRetry } from "../mutation/job-retry"
import { sdkFailureOf } from "./sdk-failure"

/** A coded error of another package (the entity engine's, the back end's): not the SDK's, so it is no SDK failure. */
class ForeignError extends DomainError<"FOREIGN_REFUSED"> {}

describe("sdkFailureOf", () => {
    it("reads the code and subject of an SDK error", () => {
        expect(sdkFailureOf(new NodeRunError("TOOL_UNKNOWN", "some.id"))).toEqual({ code: "TOOL_UNKNOWN", at: "some.id" })
        expect(sdkFailureOf(new JobRetry("some.job"))).toEqual({ code: "JOB_RETRY", at: "some.job" })
    })

    it("reads an SDK error that names no subject with an empty subject", () => {
        expect(sdkFailureOf(new JobRetry(""))).toEqual({ code: "JOB_RETRY", at: "" })
    })

    it("maps every SDK error class as before, and passes a coded error of another package through untouched", () => {
        expect(sdkFailureOf(new JobRefused("JOB_REFUSED", "tool refused"))).toEqual({ code: "JOB_REFUSED", at: "tool refused" })
        expect(sdkFailureOf(new ForeignError({ code: "FOREIGN_REFUSED", params: { at: "some.id" } }))).toBeUndefined()
        expect(sdkFailureOf(new ForeignError({ code: "FOREIGN_REFUSED" }))).toBeUndefined()
    })

    it("is undefined for any other value", () => {
        expect(sdkFailureOf(new Error("bug"))).toBeUndefined()
        expect(sdkFailureOf("text")).toBeUndefined()
    })
})
