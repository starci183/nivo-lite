import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { OfficeLog } from "@modules/domain/module-ops"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isHiringTickPayload } from "@modules/queues/hiring-tick"
import { HiringLogEvent } from "./hiring.log-events"
import { HiringCandidatesService } from "./hiring-candidates.service"
import { HiringDataService } from "./hiring-data.service"
import { HiringInterviewsService } from "./hiring-interviews.service"
import { HiringTextService } from "./hiring-text.service"
import { EXPIRE_JOBS, EXPIRE_OFFERS, LOG_RETENTION } from "./persistence/hiring.sql"
import type { IdsRow, TitlesRow } from "./persistence/hiring.rows"
import { addDays, addHours } from "./policies/vn-time.policy"

/** Hours ahead an interview is reminded. */
const REMIND_HOURS = 24

/** What one pass over a workspace did. */
export interface TickResult {
    /** Reminders sent. */
    readonly reminders: number
    /** Offers that lapsed. */
    readonly offersExpired: number
    /** Jobs closed. */
    readonly jobsClosed: number
    /** Candidates deleted by the retention. */
    readonly deletedCandidates: number
    /** CV files deleted by the retention. */
    readonly deletedFiles: number
}

/** What the retention step removed. */
interface Removed {
    readonly candidates: number
    readonly files: number
}

const NOTHING: TickResult = { reminders: 0, offersExpired: 0, jobsClosed: 0, deletedCandidates: 0, deletedFiles: 0 }

@Injectable()
/**
 * The hiring tick of one workspace, run by a job every five minutes: reminds the interviews of the next day, lapses the offers past their date, closes the jobs
 * past their closing date or filled, and deletes the rejected and withdrawn candidates whose retention ran out. Every step marks what it did, so a repeat is safe.
 */
export class HiringTickService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly office: OfficeLog,
        private readonly data: HiringDataService,
        private readonly words: HiringTextService,
        private readonly candidates: HiringCandidatesService,
        private readonly interviews: HiringInterviewsService,
    ) {}

    /** The effect of one hiring-tick job; a payload of any other job changes nothing. */
    async runJob(payload: object): Promise<void> {
        if (isHiringTickPayload(payload)) await this.run(payload.workspaceId)
    }

    /** Runs one pass over a workspace. A failing step is logged and the others still run. */
    async run(workspaceId: string): Promise<TickResult> {
        const settings = await this.data.tickWorkspace(workspaceId)
        if (settings === undefined) return NOTHING
        const none: Removed = { candidates: 0, files: 0 }
        const [reminders, offersExpired, jobsClosed, retention] = await Promise.all([
            this.guarded(workspaceId, "reminders", 0, () =>
                settings.remind_interview ? this.remind(workspaceId) : Promise.resolve(0),
            ),
            this.guarded(workspaceId, "offers", 0, () => this.expireOffers(workspaceId)),
            this.guarded(workspaceId, "jobs", 0, () => this.sweepJobs(workspaceId)),
            this.guarded(workspaceId, "retention", none, () => this.retention(workspaceId, settings.retention_days)),
        ])
        return {
            reminders,
            offersExpired,
            jobsClosed,
            deletedCandidates: retention.candidates,
            deletedFiles: retention.files,
        }
    }

    private async guarded<Value>(
        workspaceId: string,
        step: string,
        fallback: Value,
        work: () => Promise<Value>,
    ): Promise<Value> {
        try {
            return await work()
        } catch (cause) {
            this.logger.error(HiringLogEvent.TickFailed, { workspaceId, step, cause })
            return fallback
        }
    }

    private async remind(workspaceId: string): Promise<number> {
        const now = this.clock.now()
        const due = await this.data.dueReminders(workspaceId, now, addHours(now, REMIND_HOURS))
        const shop = await this.office.workspaceName(workspaceId)
        const sent = await Promise.all(due.map((interview) => this.interviews.remind(interview, shop)))
        return sent.filter(Boolean).length
    }

    private async expireOffers(workspaceId: string): Promise<number> {
        const [row] = await this.entityManager.query<Array<IdsRow>>(EXPIRE_OFFERS, [
            workspaceId,
            this.words.text("hiring.event.offerExpired"),
        ])
        return row?.ids.length ?? 0
    }

    private async sweepJobs(workspaceId: string): Promise<number> {
        const [expired] = await this.entityManager.query<Array<TitlesRow>>(EXPIRE_JOBS, [workspaceId])
        const titles = expired?.titles ?? []
        await Promise.all(
            titles.map((title) =>
                this.office.postOffice(workspaceId, this.words.text("hiring.office.jobExpired", { title })),
            ),
        )
        const live = await this.data.liveJobIds(workspaceId)
        const filled = await Promise.all(live.map((id) => this.candidates.closeJobIfFilled(workspaceId, id)))
        return titles.length + filled.filter(Boolean).length
    }

    private async retention(workspaceId: string, days: number): Promise<Removed> {
        const due = await this.data.retentionDue(workspaceId, addDays(this.clock.now(), -days))
        if (due.length === 0) return { candidates: 0, files: 0 }
        const removed = await this.candidates.deleteAll(workspaceId, due)
        await this.entityManager.query(LOG_RETENTION, [workspaceId, removed.candidates, removed.files, days])
        return removed
    }
}
