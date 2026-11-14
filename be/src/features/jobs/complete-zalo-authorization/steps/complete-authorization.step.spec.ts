import { mock } from "@starci/jest-preset"
import type { ZaloConnectService, ZaloCredentialsService } from "@modules/domain/channels"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { CompleteAuthorizationStep } from "./complete-authorization.step"

const job = (payload: object): ClaimedJob => ({ jobId: "job-1", kind: "zalo-authorization", fencingToken: 3, currentStep: null, payload })

const build = () => {
    const claims = mock<JobClaims>({ advance: jest.fn().mockResolvedValue(undefined) })
    const credentials = mock<ZaloCredentialsService>({ completeFromJob: jest.fn().mockResolvedValue(undefined) })
    const connect = mock<ZaloConnectService>({ rememberOaNameLater: jest.fn() })
    return { step: new CompleteAuthorizationStep(claims, credentials, connect), credentials, connect }
}

describe("CompleteAuthorizationStep", () => {
    it("completes the authorization, then starts reading the OA name of the connection the state names", async () => {
        const { step, credentials, connect } = build()
        const payload = { workspaceId: "ws-1", state: "c-1.nonce-1", code: "code-1", oaId: "oa-9" }

        await expect(step.run(job(payload))).resolves.toBeUndefined()

        expect(credentials.completeFromJob).toHaveBeenCalledWith(payload)
        expect(connect.rememberOaNameLater.mock.calls).toEqual([["c-1"]])
    })

    it("reads no name for a payload that is not an authorization", async () => {
        const { step, connect } = build()

        await step.run(job({ other: true }))

        expect(connect.rememberOaNameLater).not.toHaveBeenCalled()
    })

    it("fails as before when the completion fails, and reads no name", async () => {
        const { step, credentials, connect } = build()
        credentials.completeFromJob.mockRejectedValue(new Error("db down"))

        await expect(step.run(job({ workspaceId: "ws-1", state: "c-1.n", code: "x", oaId: null }))).rejects.toThrow("db down")
        expect(connect.rememberOaNameLater).not.toHaveBeenCalled()
    })
})
