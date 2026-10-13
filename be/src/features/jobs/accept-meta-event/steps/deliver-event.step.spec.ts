import { strict as assert } from "node:assert"
import { Test } from "@nestjs/testing"
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants"
import { mock } from "@starci/jest-preset"
import { MetaInboxService } from "@modules/domain/meta-inbox"
import type { MetaInboundJob } from "@modules/domain/meta-inbox"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { DeliverEventStep } from "./deliver-event.step"

const injectionTokens: ReadonlyArray<{ readonly index: number; readonly param: typeof JOB_CLAIMS }> =
    Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, DeliverEventStep)
const claimsInjection = injectionTokens.find(({ index }) => index === 1)
assert.ok(claimsInjection, "DeliverEventStep must declare its job claims injection token")
const JOB_CLAIMS: unique symbol = claimsInjection.param

const payload: MetaInboundJob = {
    connectionId: "connection-1",
    workspaceId: "workspace-1",
    event: {
        kind: "dm",
        platform: "facebook",
        page_id: "page-1",
        ig_id: null,
        sender_psid: "person-1",
        sender_igsid: null,
        sender_name: "Lan",
        text: "Hello",
        comment_id: null,
        post_id: null,
        leadgen_id: null,
        form_id: null,
        ad_id: null,
        referral: null,
        postback_payload: null,
        mid: "message-1",
        timestamp: 1791774000000,
        event_key: "dm:message-1",
    },
}

const claimedJob: ClaimedJob = {
    jobId: "job-1",
    kind: "meta_inbound",
    fencingToken: 7,
    currentStep: null,
    payload,
}

const build = async () => {
    const inbox = mock<MetaInboxService>()
    const claims = mock<JobClaims>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DeliverEventStep,
            { provide: MetaInboxService, useValue: inbox },
            { provide: JOB_CLAIMS, useValue: claims },
        ],
    }).compile()
    return { step: moduleRef.get(DeliverEventStep), inbox, claims }
}

describe("DeliverEventStep", () => {
    it("waits for the guarded advance with the claim's fencing token before delivering the event", async () => {
        const { step, inbox, claims } = await build()
        let finishAdvance!: () => void
        const advanced = new Promise<void>((resolve) => {
            finishAdvance = resolve
        })
        claims.advance.mockReturnValue(advanced)

        const running = step.run(claimedJob)

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "deliver" }]])
        expect(inbox.deliver).not.toHaveBeenCalled()

        finishAdvance()
        await expect(running).resolves.toBeUndefined()

        expect(inbox.deliver.mock.calls).toEqual([[payload]])
        expect(inbox.deliver.mock.calls[0]?.[0]).toBe(payload)
        expect(claims.advance.mock.invocationCallOrder[0]).toBeLessThan(
            Number(inbox.deliver.mock.invocationCallOrder[0]),
        )
    })

    it.each([
        null,
        "event",
        {},
        { workspaceId: "workspace-1", event: {} },
        { connectionId: 1, workspaceId: "workspace-1", event: {} },
        { connectionId: "connection-1", event: {} },
        { connectionId: "connection-1", workspaceId: false, event: {} },
        { connectionId: "connection-1", workspaceId: "workspace-1" },
        { connectionId: "connection-1", workspaceId: "workspace-1", event: "event" },
        { connectionId: "connection-1", workspaceId: "workspace-1", event: null },
    ])("advances but delivers no event for a malformed payload %p", async (invalidPayload) => {
        const { step, inbox, claims } = await build()

        await expect(step.run({ ...claimedJob, payload: Object(invalidPayload) })).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "deliver" }]])
        expect(inbox.deliver).not.toHaveBeenCalled()
    })

    it("stops before delivery when the guarded advance fences the worker out", async () => {
        const { step, inbox, claims } = await build()
        const cause = new Error("worker fenced out")
        claims.advance.mockRejectedValue(cause)

        await expect(step.run(claimedJob)).rejects.toBe(cause)

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "deliver" }]])
        expect(inbox.deliver).not.toHaveBeenCalled()
    })

    it("propagates a delivery failure after the guarded advance", async () => {
        const { step, inbox, claims } = await build()
        const cause = new Error("delivery failed")
        inbox.deliver.mockRejectedValue(cause)

        await expect(step.run(claimedJob)).rejects.toBe(cause)

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "deliver" }]])
        expect(inbox.deliver.mock.calls).toEqual([[payload]])
    })
})
