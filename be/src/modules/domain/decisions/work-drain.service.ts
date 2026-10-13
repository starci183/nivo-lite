import { Injectable } from "@nestjs/common"
import { WorkItemsService } from "@modules/domain/work-items"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { Locale } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type { WorkContext } from "./decisions.contracts"
import { WorkEngineLogEvent } from "./work-engine.log-events"
import { WorkEngineService } from "./work-engine.service"

/** The most workspaces one drain tick visits. */
const WORKSPACE_LIMIT = 50

/** The most queued steps one tick runs per workspace (the web app drained two to four after each response). */
const STEPS_PER_WORKSPACE = 4

/** The wall-clock budget of one tick: a step can call a model, and the next tick picks up what is left. */
const DRAIN_BUDGET_MS = 40_000

/** Who the background drain acts as in the logs and the Office. */
const DRAIN_ACTOR = "NIVO"

/** The language of the text a background step writes: the product language, as no person is reading. */
const DRAIN_LOCALE: Locale = "vi"

@Injectable()
/**
 * The background drain of the chain steps: a finished item queues the next department's step (classify, follow-up, invoice, care)
 * and only inserts it; the receiver's own gate decides it when a drain takes it. The web app used to drain after every response; now
 * the decisions queue's minute tick does, workspace by workspace, inside a time budget. A failing workspace is logged and the others
 * still run; a failing step is already marked failed by the engine.
 */
export class WorkDrainService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly items: WorkItemsService,
        private readonly engine: WorkEngineService,
    ) {}

    /** Drains the queued steps of the workspaces that have some; answers how many steps ran. */
    async drainAll(): Promise<number> {
        const deadline = this.clock.now().getTime() + DRAIN_BUDGET_MS
        const workspaces = await this.items.workspacesWithQueued(WORKSPACE_LIMIT)
        let ran = 0
        await eachInOrder(workspaces, async (workspaceId) => {
            if (this.clock.now().getTime() >= deadline) return
            const ctx: WorkContext = { workspaceId, actor: DRAIN_ACTOR, locale: DRAIN_LOCALE }
            try {
                ran += await this.engine.runQueued(ctx, STEPS_PER_WORKSPACE)
            } catch (cause) {
                this.logger.error(WorkEngineLogEvent.DrainFailed, cause, { workspaceId })
            }
        })
        return ran
    }
}
