import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AppCommandsService } from "@modules/domain/app-commands"
import type { AppCommand } from "@modules/domain/app-commands"
import { VideoError, VideoErrorCode } from "./errors/video.error"
import { VideoRenderCommandsService } from "./video-render-commands.service"
import { VideoService } from "./video.service"

const command = (input: Readonly<Record<string, unknown>> = { projectId: "project-1" }): AppCommand => ({
    id: "command-1",
    workspaceId: "ws-1",
    requestedBy: "user-1",
    kind: "video.render",
    input,
})

const build = async (begun: AppCommand | null = command()) => {
    const commands = mock<AppCommandsService>()
    commands.begin.mockResolvedValue(begun)
    const video = mock<VideoService>()
    video.requestRender.mockResolvedValue({ renderId: "render-1", projectId: "project-1" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoRenderCommandsService,
            { provide: AppCommandsService, useValue: commands },
            { provide: VideoService, useValue: video },
        ],
    }).compile()
    return { service: moduleRef.get(VideoRenderCommandsService), commands, video }
}

describe("VideoRenderCommandsService", () => {
    it("leaves a payload that names no command alone", async () => {
        const { service, commands } = await build()

        await expect(service.run({ other: "x" })).resolves.toBeUndefined()

        expect(commands.begin).not.toHaveBeenCalled()
    })

    it("leaves a command that is already settled alone", async () => {
        const { service, commands, video } = await build(null)

        await service.run({ commandId: "command-1" })

        expect(commands.begin).toHaveBeenCalledWith("command-1")
        expect(video.requestRender).not.toHaveBeenCalled()
    })

    it("queues the render as the person who asked and answers it on the command", async () => {
        const { service, commands, video } = await build()

        await service.run({ commandId: "command-1" })

        expect(video.requestRender).toHaveBeenCalledWith("user-1", "project-1")
        expect(commands.succeed).toHaveBeenCalledWith("command-1", { renderId: "render-1", projectId: "project-1" })
    })

    it("asks for an empty project when the input names none", async () => {
        const { service, video } = await build(command({ projectId: 7 }))

        await service.run({ commandId: "command-1" })

        expect(video.requestRender).toHaveBeenCalledWith("user-1", "")
    })

    it("settles a refusal of the domain as failed with its code", async () => {
        const { service, commands, video } = await build()
        video.requestRender.mockRejectedValue(new VideoError({ code: VideoErrorCode.ProjectBusy }))

        await service.run({ commandId: "command-1" })

        expect(commands.fail).toHaveBeenCalledWith("command-1", VideoErrorCode.ProjectBusy)
        expect(commands.succeed).not.toHaveBeenCalled()
    })

    it("throws any other failure so the queue retries the delivery", async () => {
        const failure = new Error("database down")
        const { service, commands, video } = await build()
        video.requestRender.mockRejectedValue(failure)

        await expect(service.run({ commandId: "command-1" })).rejects.toBe(failure)

        expect(commands.fail).not.toHaveBeenCalled()
    })

    it("settles the command of an abandoned job as unavailable", async () => {
        const { service, commands } = await build()

        await service.abandon({ commandId: "command-1" })

        expect(commands.fail).toHaveBeenCalledWith("command-1", "unavailable")
    })

    it("leaves an abandoned payload that names no command alone", async () => {
        const { service, commands } = await build()

        await service.abandon({})

        expect(commands.fail).not.toHaveBeenCalled()
    })
})
