import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AppCommandsService } from "@modules/domain/app-commands"
import type { AppCommand } from "@modules/domain/app-commands"
import { VideoService } from "@modules/domain/video/video.service"
import { DomainError } from "@modules/platform/errors"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { RequestRenderStep } from "./request-render.step"

class DomainRefusal extends DomainError<string> {}

const commandOf = builder<AppCommand>({
    id: "command-1",
    workspaceId: "workspace-1",
    requestedBy: "person-1",
    kind: "video.render",
    input: { projectId: "project-1" },
})

const jobOf = builder<ClaimedJob>({
    jobId: "job-1",
    kind: "render_request",
    fencingToken: 7,
    currentStep: null,
    payload: { commandId: "command-1" },
})

const build = async () => {
    const commands = mock<AppCommandsService>()
    const video = mock<VideoService>()
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    commands.begin.mockResolvedValue(commandOf())
    video.requestRender.mockResolvedValue({ renderId: "render-1", projectId: "queued-project-1" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            RequestRenderStep,
            { provide: AppCommandsService, useValue: commands },
            { provide: VideoService, useValue: video },
        ],
    })
        .useMocker((token) => {
            if (typeof token === "symbol" && token.description === "platform.jobs.claims") return claims
            throw new DomainRefusal({ code: "UNEXPECTED_TEST_DEPENDENCY" })
        })
        .compile()
    return { step: moduleRef.get(RequestRenderStep), commands, video, claims }
}

describe("RequestRenderStep", () => {
    it("awaits the fenced advance before opening the command and queuing its render", async () => {
        const { step, commands, video, claims } = await build()
        let advanced = false
        claims.advance.mockImplementation(async () => {
            expect(commands.begin.mock.calls).toEqual([])
            expect(video.requestRender.mock.calls).toEqual([])
            await Promise.resolve()
            advanced = true
        })
        commands.begin.mockImplementation(() => {
            expect(advanced).toBe(true)
            return Promise.resolve(commandOf())
        })

        await expect(step.run(jobOf())).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "request" }]])
        expect(commands.begin.mock.calls).toEqual([["command-1"]])
        expect(video.requestRender.mock.calls).toEqual([["person-1", "project-1"]])
        expect(commands.succeed.mock.calls).toEqual([
            ["command-1", { renderId: "render-1", projectId: "queued-project-1" }],
        ])
        expect(commands.fail.mock.calls).toEqual([])
    })

    it("does not perform an effect after a fenced advance is refused", async () => {
        const { step, commands, video, claims } = await build()
        const cause = new Error("stale fencing token")
        claims.advance.mockRejectedValue(cause)

        await expect(step.run(jobOf())).rejects.toBe(cause)

        expect(commands.begin.mock.calls).toEqual([])
        expect(video.requestRender.mock.calls).toEqual([])
        expect(commands.succeed.mock.calls).toEqual([])
        expect(commands.fail.mock.calls).toEqual([])
    })

    it.each([{}, { commandId: 42 }])("leaves a bad payload alone after advancing: %j", async (payload) => {
        const { step, commands, video, claims } = await build()

        await expect(step.run(jobOf({ payload }))).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "request" }]])
        expect(commands.begin.mock.calls).toEqual([])
        expect(video.requestRender.mock.calls).toEqual([])
        expect(commands.succeed.mock.calls).toEqual([])
        expect(commands.fail.mock.calls).toEqual([])
    })

    it("leaves an unknown or already settled command alone", async () => {
        const { step, commands, video } = await build()
        commands.begin.mockResolvedValue(null)

        await expect(step.run(jobOf())).resolves.toBeUndefined()

        expect(commands.begin.mock.calls).toEqual([["command-1"]])
        expect(video.requestRender.mock.calls).toEqual([])
        expect(commands.succeed.mock.calls).toEqual([])
        expect(commands.fail.mock.calls).toEqual([])
    })

    it.each([{}, { projectId: null }, { projectId: 42 }])(
        "passes an empty project id to the video capability for invalid input: %j",
        async (input) => {
            const { step, commands, video } = await build()
            commands.begin.mockResolvedValue(commandOf({ input }))

            await expect(step.run(jobOf())).resolves.toBeUndefined()

            expect(video.requestRender.mock.calls).toEqual([["person-1", ""]])
            expect(commands.succeed.mock.calls).toEqual([
                ["command-1", { renderId: "render-1", projectId: "queued-project-1" }],
            ])
            expect(commands.fail.mock.calls).toEqual([])
        },
    )

    it("settles a domain refusal with its exact code", async () => {
        const { step, commands, video } = await build()
        video.requestRender.mockRejectedValue(new DomainRefusal({ code: "VIDEO_PROJECT_BUSY" }))

        await expect(step.run(jobOf())).resolves.toBeUndefined()

        expect(video.requestRender.mock.calls).toEqual([["person-1", "project-1"]])
        expect(commands.succeed.mock.calls).toEqual([])
        expect(commands.fail.mock.calls).toEqual([["command-1", "VIDEO_PROJECT_BUSY"]])
    })

    it("rethrows a non-domain render failure for the queue to retry", async () => {
        const { step, commands, video } = await build()
        const cause = new Error("render queue unavailable")
        video.requestRender.mockRejectedValue(cause)

        await expect(step.run(jobOf())).rejects.toBe(cause)

        expect(video.requestRender.mock.calls).toEqual([["person-1", "project-1"]])
        expect(commands.succeed.mock.calls).toEqual([])
        expect(commands.fail.mock.calls).toEqual([])
    })

    it("rethrows a command completion failure for the queue to retry", async () => {
        const { step, commands } = await build()
        const cause = new Error("command result write unavailable")
        commands.succeed.mockRejectedValue(cause)

        await expect(step.run(jobOf())).rejects.toBe(cause)

        expect(commands.succeed.mock.calls).toEqual([
            ["command-1", { renderId: "render-1", projectId: "queued-project-1" }],
        ])
        expect(commands.fail.mock.calls).toEqual([])
    })

    it("fails an abandoned command as unavailable without opening or rendering it", async () => {
        const { step, commands, video, claims } = await build()

        await expect(step.abandon({ commandId: "abandoned-command-1" })).resolves.toBeUndefined()

        expect(commands.fail.mock.calls).toEqual([["abandoned-command-1", "unavailable"]])
        expect(commands.begin.mock.calls).toEqual([])
        expect(commands.succeed.mock.calls).toEqual([])
        expect(video.requestRender.mock.calls).toEqual([])
        expect(claims.advance.mock.calls).toEqual([])
    })

    it.each([{}, { commandId: false }])("leaves a bad abandoned payload alone: %j", async (payload) => {
        const { step, commands, video, claims } = await build()

        await expect(step.abandon(payload)).resolves.toBeUndefined()

        expect(commands.fail.mock.calls).toEqual([])
        expect(commands.begin.mock.calls).toEqual([])
        expect(commands.succeed.mock.calls).toEqual([])
        expect(video.requestRender.mock.calls).toEqual([])
        expect(claims.advance.mock.calls).toEqual([])
    })
})
