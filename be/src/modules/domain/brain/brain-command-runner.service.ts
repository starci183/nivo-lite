import { Injectable } from "@nestjs/common"
import { BrainCommandsService } from "@modules/domain/brain-commands"
import type { CommandResult } from "@modules/domain/brain-commands"
import { KnowledgeDriveService, KnowledgeReembedService, KnowledgeSearchService } from "@modules/domain/knowledge"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { DomainError } from "@modules/platform/errors"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainLearningService } from "./brain-learning.service"
import { BrainService } from "./brain.service"
import { commandPayloadOf } from "./command-job.policy"
import { commandOf } from "./command-payload.policy"
import type { BrainCommand } from "./command-payload.policy"
import { BrainLogEvent } from "./brain.log-events"
import type { CommandOutcome } from "./brain.contracts"

/** The stored code of a command whose kind or fields are not valid. */
const INVALID = "BRAIN_COMMAND_INVALID"

@Injectable()
/**
 * Carries out the commands the Second Brain and Knowledge pages ask for. The page cannot reach the back end, so it writes a command
 * row and queues a job; this runs it as the person who asked (every service proves their role again), and closes the row with the
 * result, or with the stored code of the refusal, for the page to read.
 */
export class BrainCommandRunnerService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly commands: BrainCommandsService,
        private readonly brain: BrainService,
        private readonly learning: BrainLearningService,
        private readonly sources: KnowledgeSourcesService,
        private readonly search: KnowledgeSearchService,
        private readonly drive: KnowledgeDriveService,
        private readonly reembed: KnowledgeReembedService,
    ) {}

    /** Runs the command a job names. A refusal of the services is a normal end (the row says why); any other failure is thrown for the queue to retry. */
    async run(payload: object): Promise<CommandOutcome> {
        const ref = commandPayloadOf(payload)
        if (ref === null) {
            this.logger.warn(BrainLogEvent.PayloadRefused, { job: "command" })
            return "skipped"
        }
        const command = await this.commands.get(ref.workspaceId, ref.commandId)
        if (command === null || command.status === "done" || command.status === "failed") return "skipped"
        if (!(await this.commands.begin(ref.workspaceId, ref.commandId))) return "skipped"
        const parsed = commandOf(command.kind, command.payload)
        if (parsed === null) {
            await this.commands.fail(ref.workspaceId, ref.commandId, INVALID)
            return "failed"
        }
        try {
            const result = await this.execute(command.requestedBy, ref.workspaceId, parsed)
            await this.commands.finish(ref.workspaceId, ref.commandId, result)
            return "done"
        } catch (cause) {
            if (!(cause instanceof DomainError)) throw cause
            this.logger.warn(BrainLogEvent.CommandRefused, { code: cause.code, commandId: ref.commandId })
            await this.commands.fail(ref.workspaceId, ref.commandId, cause.code)
            return "failed"
        }
    }

    /** The job ended as failed (the retries ran out): the command row says so. */
    async giveUp(payload: object): Promise<void> {
        const ref = commandPayloadOf(payload)
        if (ref !== null) await this.commands.fail(ref.workspaceId, ref.commandId, "BRAIN_COMMAND_FAILED")
    }

    /** Does what the command asks, for the person who asked; answers what the page shows. */
    private async execute(userId: string, workspaceId: string, command: BrainCommand): Promise<CommandResult> {
        switch (command.kind) {
            case "fact.save": {
                const saved = await this.brain.saveFact(userId, workspaceId, command.form)
                return { outcome: saved.outcome, factId: saved.fact.id }
            }
            case "fact.decide": {
                const fact = await this.brain.decideFact(userId, { workspaceId, ...command.decision })
                return { factId: fact.id }
            }
            case "fact.keep": {
                const rejected = await this.brain.keepCurrent(userId, { workspaceId, ...command.keep })
                return { rejected }
            }
            case "lesson.save": {
                const lesson = await this.brain.saveLesson(userId, { workspaceId, ...command.form })
                return { lessonId: lesson.id }
            }
            case "lesson.decide": {
                const lesson = await this.brain.decideLesson(userId, { workspaceId, ...command.decision })
                return { lessonId: lesson.id }
            }
            case "gap.dismiss":
                await this.brain.dismissGap(userId, workspaceId, command.id)
                return null
            case "brain.maintain":
                await this.brain.maintain(userId, workspaceId)
                return null
            case "lessons.mine":
                return this.learning.mine(userId, workspaceId, command.module)
            case "source.delete":
                await this.brain.removeSource(userId, workspaceId, command.sourceId)
                return null
            case "source.reindex":
                return this.sources.reindexSource(userId, workspaceId, command.reindex)
            case "source.update":
                await this.sources.updateSource(userId, workspaceId, command.update)
                return null
            case "knowledge.reembed":
                await this.reembed.request(userId, workspaceId)
                return null
            case "knowledge.ask":
                return { passages: await this.search.ask(userId, workspaceId, command.ask) }
            case "drive.linked":
                return this.drive.listLinkedFolder(userId, workspaceId, command.url)
            case "drive.picked":
                return this.drive.listPickedFolder(userId, workspaceId, command.picked.folderId, command.picked.token)
        }
    }
}
