import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { ContentService } from "@modules/domain/content"
import { JOB_CLAIMS } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { RunAutomationsStep } from "./run-automations.step"

const jobOf = builder<ClaimedJob>({
    jobId: "content-job-1",
    kind: "content_tick",
    fencingToken: 7,
    currentStep: null,
    payload: { workspaceId: "workspace-1", force: true },
})

const build = async () => {
    const content = mock<ContentService>()
    const claims = mock<JobClaims>()
    content.runTick.mockResolvedValue([])
    claims.advance.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            RunAutomationsStep,
            { provide: ContentService, useValue: content },
            { provide: JOB_CLAIMS, useValue: claims },
        ],
    }).compile()
    return { step: moduleRef.get(RunAutomationsStep), content, claims }
}

describe("RunAutomationsStep", () => {
    it("waits for the fenced run write before running the content automations", async () => {
        const { step, content, claims } = await build()
        let release: () => void = () => undefined
        const advanced = new Promise<void>((resolve) => {
            release = resolve
        })
        claims.advance.mockReturnValue(advanced)

        const running = step.run(jobOf())

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "content-job-1", expectedFencingToken: 7, step: "run" }],
        ])
        expect(content.runTick.mock.calls).toEqual([])
        release()
        await expect(running).resolves.toBeUndefined()
        expect(content.runTick.mock.calls).toEqual([[{ workspaceId: "workspace-1", force: true }]])
        expect(claims.complete.mock.calls).toEqual([])
        expect(claims.fail.mock.calls).toEqual([])
    })

    it.each([
        { payload: {}, request: {} },
        { payload: { workspaceId: "workspace-2" }, request: { workspaceId: "workspace-2" } },
        { payload: { force: true }, request: { force: true } },
        { payload: { workspaceId: "", force: false }, request: { workspaceId: "" } },
        { payload: { workspaceId: 42, force: "true" }, request: {} },
        { payload: { workspaceId: null, force: null }, request: {} },
        {
            payload: { workspaceId: "workspace-2", force: true, ignored: "extra" },
            request: { workspaceId: "workspace-2", force: true },
        },
    ])("runs the parsed content tick for payload $payload", async ({ payload, request }) => {
        const { step, content, claims } = await build()

        await expect(step.run(jobOf({ payload }))).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "content-job-1", expectedFencingToken: 7, step: "run" }],
        ])
        expect(content.runTick.mock.calls).toEqual([[request]])
    })

    it("propagates a stale-token refusal before running any automations", async () => {
        const { step, content, claims } = await build()
        const refusal = new Error("JOBS_FENCED_OUT")
        claims.advance.mockRejectedValue(refusal)

        await expect(step.run(jobOf())).rejects.toBe(refusal)

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "content-job-1", expectedFencingToken: 7, step: "run" }],
        ])
        expect(content.runTick.mock.calls).toEqual([])
        expect(claims.complete.mock.calls).toEqual([])
        expect(claims.fail.mock.calls).toEqual([])
    })

    it("propagates the automation failure after recording the fenced step", async () => {
        const { step, content, claims } = await build()
        const failure = new Error("content tick unavailable")
        content.runTick.mockRejectedValue(failure)

        await expect(step.run(jobOf())).rejects.toBe(failure)

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "content-job-1", expectedFencingToken: 7, step: "run" }],
        ])
        expect(content.runTick.mock.calls).toEqual([[{ workspaceId: "workspace-1", force: true }]])
        expect(claims.complete.mock.calls).toEqual([])
        expect(claims.fail.mock.calls).toEqual([])
    })
})
