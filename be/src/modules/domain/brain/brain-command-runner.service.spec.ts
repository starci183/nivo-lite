import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { BrainCommandsService } from "@modules/domain/brain-commands"
import { KnowledgeDriveService, KnowledgeReembedService, KnowledgeSearchService } from "@modules/domain/knowledge"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainCommandRunnerService } from "./brain-command-runner.service"
import { BrainLearningService } from "./brain-learning.service"
import { BrainLogEvent } from "./brain.log-events"
import { BrainService } from "./brain.service"
import { BrainError, BrainErrorCode } from "./errors/brain.error"

const PAYLOAD = { commandId: "cmd-1", workspaceId: "ws-1" }

/** A command row as the commands capability answers it. */
type CommandRecord = NonNullable<Awaited<ReturnType<BrainCommandsService["get"]>>>

const commandOf = builder<CommandRecord>({
    id: "cmd-1",
    workspaceId: "ws-1",
    requestedBy: "user-1",
    kind: "gap.dismiss",
    payload: { id: "gap-1" },
    status: "queued",
})

const build = async (command: CommandRecord | null = commandOf()) => {
    const logger = mock<Logger>()
    const commands = mock<BrainCommandsService>({
        get: jest.fn(() => Promise.resolve(command)),
        begin: jest.fn(() => Promise.resolve(true)),
        finish: jest.fn(() => Promise.resolve()),
        fail: jest.fn(() => Promise.resolve()),
    })
    const brain = mock<BrainService>({ dismissGap: jest.fn(() => Promise.resolve()) })
    const learning = mock<BrainLearningService>()
    const sources = mock<KnowledgeSourcesService>()
    const search = mock<KnowledgeSearchService>({ ask: jest.fn(() => Promise.resolve([])) })
    const drive = mock<KnowledgeDriveService>()
    const reembed = mock<KnowledgeReembedService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainCommandRunnerService,
            { provide: LOGGER, useValue: logger },
            { provide: BrainCommandsService, useValue: commands },
            { provide: BrainService, useValue: brain },
            { provide: BrainLearningService, useValue: learning },
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: KnowledgeSearchService, useValue: search },
            { provide: KnowledgeDriveService, useValue: drive },
            { provide: KnowledgeReembedService, useValue: reembed },
        ],
    }).compile()
    return { runner: moduleRef.get(BrainCommandRunnerService), logger, commands, brain, search }
}

describe("BrainCommandRunnerService", () => {
    describe("run", () => {
        it("carries out the command as the person who asked and closes it with the result", async () => {
            const { runner, commands, brain } = await build()

            await expect(runner.run(PAYLOAD)).resolves.toBe("done")

            expect(brain.dismissGap).toHaveBeenCalledWith("user-1", "ws-1", "gap-1")
            expect(commands.finish.mock.calls).toEqual([["ws-1", "cmd-1", null]])
        })

        it("answers the passages of a question asked against the knowledge", async () => {
            const { runner, commands, search } = await build(
                commandOf({
                    kind: "knowledge.ask",
                    payload: { question: "Opening hours?", module: "sales", audience: "customer" },
                }),
            )

            await expect(runner.run(PAYLOAD)).resolves.toBe("done")

            expect(search.ask).toHaveBeenCalledWith("user-1", "ws-1", {
                question: "Opening hours?",
                module: "sales",
                audience: "customer",
            })
            expect(commands.finish.mock.calls).toEqual([["ws-1", "cmd-1", { passages: [] }]])
        })

        it("closes a command whose fields are not valid as invalid", async () => {
            const { runner, commands } = await build(commandOf({ payload: {} }))

            await expect(runner.run(PAYLOAD)).resolves.toBe("failed")

            expect(commands.fail.mock.calls).toEqual([["ws-1", "cmd-1", "BRAIN_COMMAND_INVALID"]])
        })

        it("closes a command the services refuse with the stored code of the refusal", async () => {
            const { runner, commands, brain, logger } = await build()
            brain.dismissGap.mockRejectedValue(new BrainError({ code: BrainErrorCode.CommandNotFound }))

            await expect(runner.run(PAYLOAD)).resolves.toBe("failed")

            expect(commands.fail.mock.calls).toEqual([["ws-1", "cmd-1", BrainErrorCode.CommandNotFound]])
            expect(logger.warn).toHaveBeenCalledWith(BrainLogEvent.CommandRefused, {
                code: BrainErrorCode.CommandNotFound,
                commandId: "cmd-1",
            })
        })

        it("lets any other failure through for the queue to retry", async () => {
            const { runner, commands, brain } = await build()
            const failure = new Error("connection reset")
            brain.dismissGap.mockRejectedValue(failure)

            await expect(runner.run(PAYLOAD)).rejects.toBe(failure)
            expect(commands.fail).not.toHaveBeenCalled()
        })

        it("skips a payload of another shape, a closed command and one another worker took", async () => {
            const refused = await build()
            const closed = await build(commandOf({ status: "done" }))
            const missing = await build(null)
            const taken = await build()
            taken.commands.begin.mockResolvedValue(false)

            await expect(refused.runner.run({ other: true })).resolves.toBe("skipped")
            await expect(closed.runner.run(PAYLOAD)).resolves.toBe("skipped")
            await expect(missing.runner.run(PAYLOAD)).resolves.toBe("skipped")
            await expect(taken.runner.run(PAYLOAD)).resolves.toBe("skipped")
            expect(refused.logger.warn).toHaveBeenCalledWith(BrainLogEvent.PayloadRefused, { job: "command" })
            expect(taken.commands.finish).not.toHaveBeenCalled()
        })
    })

    describe("giveUp", () => {
        it("closes the command of a job that ran out of retries, and ignores another payload", async () => {
            const { runner, commands } = await build()

            await runner.giveUp(PAYLOAD)
            await runner.giveUp({ other: true })

            expect(commands.fail.mock.calls).toEqual([["ws-1", "cmd-1", "BRAIN_COMMAND_FAILED"]])
        })
    })
})
