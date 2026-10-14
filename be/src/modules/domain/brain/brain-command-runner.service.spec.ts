import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { BrainCommandsService } from "@modules/domain/brain-commands"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { LessonRecord } from "@modules/domain/brain-lessons"
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
const AT = "2026-10-14T00:00:00.000Z"
const fact: FactRecord = {
    id: "fact-1",
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "hours",
    attributeLabel: "Hours",
    value: "8am to 9pm",
    valueNumber: null,
    unit: null,
    scope: "public",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 100,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "Ada",
    proposedAt: AT,
    decidedBy: "Ada",
    decidedAt: AT,
    decisionNote: null,
}
const lesson: LessonRecord = {
    id: "lesson-1",
    module: "sales",
    title: "Confirm",
    body: "Ask first",
    appliesWhen: "Unsure",
    status: "active",
    origin: "manual",
    evidence: [],
    version: 1,
    proposedBy: "Ada",
    proposedAt: AT,
    decidedBy: "Ada",
    decidedAt: AT,
}

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
    return {
        runner: moduleRef.get(BrainCommandRunnerService),
        logger,
        commands,
        brain,
        search,
        learning,
        sources,
        drive,
        reembed,
    }
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

        it("saves a fact with the requester and closes the command with its outcome and id", async () => {
            const form = {
                subjectType: "business",
                subjectLabel: "Shop",
                attributeLabel: "Hours",
                value: "8am to 9pm",
                scope: "public",
                modules: ["sales"],
                validFrom: "2026-10-01",
                validTo: "2026-10-31",
                note: "October hours",
                gapId: "gap-1",
            }
            const { runner, commands, brain } = await build(commandOf({ kind: "fact.save", payload: form }))
            brain.saveFact.mockResolvedValue({ outcome: "applied", fact })

            await expect(runner.run(PAYLOAD)).resolves.toBe("done")

            expect(brain.saveFact.mock.calls).toEqual([["user-1", "ws-1", form]])
            expect(commands.finish.mock.calls).toEqual([["ws-1", "cmd-1", { outcome: "applied", factId: "fact-1" }]])
        })

        it("decides a fact with the command workspace and returns its id", async () => {
            const decision = { id: "fact-1", action: "split", note: "Different hours", situation: "Weekends" }
            const { runner, commands, brain } = await build(commandOf({ kind: "fact.decide", payload: decision }))
            brain.decideFact.mockResolvedValue(fact)

            await expect(runner.run(PAYLOAD)).resolves.toBe("done")

            expect(brain.decideFact.mock.calls).toEqual([["user-1", { workspaceId: "ws-1", ...decision }]])
            expect(commands.finish.mock.calls).toEqual([["ws-1", "cmd-1", { factId: "fact-1" }]])
        })

        it("keeps the current fact and answers how many proposals were rejected", async () => {
            const keep = { subjectKey: "shop", attribute: "hours", installationId: "agent-1" }
            const { runner, commands, brain } = await build(commandOf({ kind: "fact.keep", payload: keep }))
            brain.keepCurrent.mockResolvedValue(3)

            await expect(runner.run(PAYLOAD)).resolves.toBe("done")

            expect(brain.keepCurrent.mock.calls).toEqual([["user-1", { workspaceId: "ws-1", ...keep }]])
            expect(commands.finish.mock.calls).toEqual([["ws-1", "cmd-1", { rejected: 3 }]])
        })

        it("writes a lesson in the command workspace and returns its id", async () => {
            const form = { module: "sales", title: "Confirm", body: "Ask first", appliesWhen: "Unsure" }
            const { runner, commands, brain } = await build(commandOf({ kind: "lesson.save", payload: form }))
            brain.saveLesson.mockResolvedValue(lesson)

            await expect(runner.run(PAYLOAD)).resolves.toBe("done")

            expect(brain.saveLesson.mock.calls).toEqual([["user-1", { workspaceId: "ws-1", ...form }]])
            expect(commands.finish.mock.calls).toEqual([["ws-1", "cmd-1", { lessonId: "lesson-1" }]])
        })

        it("decides a lesson in the command workspace and returns its id", async () => {
            const decision = { id: "lesson-1", action: "active" }
            const { runner, commands, brain } = await build(commandOf({ kind: "lesson.decide", payload: decision }))
            brain.decideLesson.mockResolvedValue(lesson)

            await expect(runner.run(PAYLOAD)).resolves.toBe("done")

            expect(brain.decideLesson.mock.calls).toEqual([["user-1", { workspaceId: "ws-1", ...decision }]])
            expect(commands.finish.mock.calls).toEqual([["ws-1", "cmd-1", { lessonId: "lesson-1" }]])
        })

        it("maintains the brain as the requester and closes without a result", async () => {
            const { runner, commands, brain } = await build(commandOf({ kind: "brain.maintain", payload: {} }))
            brain.maintain.mockResolvedValue()

            await expect(runner.run(PAYLOAD)).resolves.toBe("done")

            expect(brain.maintain.mock.calls).toEqual([["user-1", "ws-1"]])
            expect(commands.finish.mock.calls).toEqual([["ws-1", "cmd-1", null]])
        })

        it("mines one module and returns the learning outcome", async () => {
            const { runner, commands, learning } = await build(
                commandOf({ kind: "lessons.mine", payload: { module: "sales" } }),
            )
            const result = { corrections: 5, newCases: 3, proposed: 2 }
            learning.mine.mockResolvedValue(result)

            await expect(runner.run(PAYLOAD)).resolves.toBe("done")

            expect(learning.mine.mock.calls).toEqual([["user-1", "ws-1", "sales"]])
            expect(commands.finish.mock.calls).toEqual([["ws-1", "cmd-1", result]])
        })

        it("deletes a source through the brain and closes without a result", async () => {
            const { runner, commands, brain } = await build(
                commandOf({ kind: "source.delete", payload: { sourceId: "source-1" } }),
            )
            brain.removeSource.mockResolvedValue()

            await expect(runner.run(PAYLOAD)).resolves.toBe("done")

            expect(brain.removeSource.mock.calls).toEqual([["user-1", "ws-1", "source-1"]])
            expect(commands.finish.mock.calls).toEqual([["ws-1", "cmd-1", null]])
        })

        it("reindexes a source with replacement text and returns its reference", async () => {
            const reindex = { sourceId: "source-1", content: "New text" }
            const { runner, commands, sources } = await build(commandOf({ kind: "source.reindex", payload: reindex }))
            sources.reindexSource.mockResolvedValue({ id: "source-1" })

            await expect(runner.run(PAYLOAD)).resolves.toBe("done")

            expect(sources.reindexSource.mock.calls).toEqual([["user-1", "ws-1", reindex]])
            expect(commands.finish.mock.calls).toEqual([["ws-1", "cmd-1", { id: "source-1" }]])
        })

        it("updates all source metadata and closes without a result", async () => {
            const update = {
                sourceId: "source-1",
                title: "Guide",
                topic: "Hours",
                tags: ["sales"],
                module: "sales",
                visibility: "internal",
            }
            const { runner, commands, sources } = await build(commandOf({ kind: "source.update", payload: update }))
            sources.updateSource.mockResolvedValue()

            await expect(runner.run(PAYLOAD)).resolves.toBe("done")

            expect(sources.updateSource.mock.calls).toEqual([["user-1", "ws-1", update]])
            expect(commands.finish.mock.calls).toEqual([["ws-1", "cmd-1", null]])
        })

        it("requests reembedding as the requester and closes without a result", async () => {
            const { runner, commands, reembed } = await build(commandOf({ kind: "knowledge.reembed", payload: {} }))
            reembed.request.mockResolvedValue()

            await expect(runner.run(PAYLOAD)).resolves.toBe("done")

            expect(reembed.request.mock.calls).toEqual([["user-1", "ws-1"]])
            expect(commands.finish.mock.calls).toEqual([["ws-1", "cmd-1", null]])
        })

        it("lists a linked Drive folder and returns its listing", async () => {
            const { runner, commands, drive } = await build(
                commandOf({ kind: "drive.linked", payload: { url: "https://drive.example/folder" } }),
            )
            const listing = { name: "Guides", files: [], truncated: false }
            drive.listLinkedFolder.mockResolvedValue(listing)

            await expect(runner.run(PAYLOAD)).resolves.toBe("done")

            expect(drive.listLinkedFolder.mock.calls).toEqual([["user-1", "ws-1", "https://drive.example/folder"]])
            expect(commands.finish.mock.calls).toEqual([["ws-1", "cmd-1", listing]])
        })

        it("lists a picked Drive folder using its token and returns its listing", async () => {
            const { runner, commands, drive } = await build(
                commandOf({ kind: "drive.picked", payload: { folderId: "folder-1", token: "picker-token" } }),
            )
            const listing = { name: "Guides", files: [], truncated: false, empty: true }
            drive.listPickedFolder.mockResolvedValue(listing)

            await expect(runner.run(PAYLOAD)).resolves.toBe("done")

            expect(drive.listPickedFolder.mock.calls).toEqual([["user-1", "ws-1", "folder-1", "picker-token"]])
            expect(commands.finish.mock.calls).toEqual([["ws-1", "cmd-1", listing]])
        })

        it("skips failed commands without beginning them again", async () => {
            const { runner, commands } = await build(commandOf({ status: "failed" }))

            await expect(runner.run(PAYLOAD)).resolves.toBe("skipped")

            expect(commands.get.mock.calls).toEqual([["ws-1", "cmd-1"]])
            expect(commands.begin).not.toHaveBeenCalled()
            expect(commands.finish).not.toHaveBeenCalled()
            expect(commands.fail).not.toHaveBeenCalled()
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
