import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ContentItemsService } from "@modules/domain/content-items"
import type { DueItem } from "@modules/domain/content-items"
import { ContentSettingsService } from "@modules/domain/content-settings"
import type { TickWorkspace } from "@modules/domain/content-settings"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { ContentLogEvent } from "./content.log-events"
import type { AutomationKey, TickDone, TickRequest } from "./content.contracts"
import {
    dayWindow,
    hhmm,
    isReminderDue,
    isSummaryDue,
    lastWeekWindow,
    vnDateKey,
    weekStartKey,
} from "./content-time.policy"
import {
    INSERT_EVIDENCE,
    INSERT_NOTICE,
    SELECT_CADENCE_CHANNELS,
    SELECT_FRESH_SOURCES,
    SELECT_PILLARS,
} from "./persistence/content.sql"
import type { CadenceRow, FreshSourceRow, PillarRow } from "./persistence/content.rows"

/** The id every uuid sorts after: where the keyset scan of the workspaces starts. */
const NIL_UUID = "00000000-0000-0000-0000-000000000000"

/** How many workspaces one page of the scan reads. */
const TICK_PAGE = 200

/** The language the notices are written in. */
const NOTICE_LOCALE = "vi"

/** At most this many new knowledge sources become post ideas in one tick. */
const OFFERS_PER_TICK = 2

/** The statuses of a post that is still to be written, approved or posted. */
const OPEN_STATUSES: ReadonlyArray<string> = ["approved", "draft", "waiting_approval"]

@Injectable()
/**
 * The three content automations. Each is a switch on the workbench; the quarter-hour tick calls `runTick`, which runs the ones that are due for
 * each workspace. Nothing here posts anywhere: a reminder and a summary are notices in the Office, and an offer becomes a post idea that
 * the owner drafts and sends for approval.
 *   today_reminder   from 07:00 (Vietnam time): what is due to be posted today, and what is still not approved
 *   weekly_summary   Monday from 08:00: last week's posts and the balance across themes
 *   offer_draft      a public knowledge source about a new offer appeared: an idea for a post about it
 */
export class ContentService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly items: ContentItemsService,
        private readonly settings: ContentSettingsService,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Runs the switched-on automations that are due, for every workspace (or the one the request names). One workspace failing does not stop the others. */
    runTick(request: TickRequest): Promise<Array<TickDone>> {
        const only = request.workspaceId
        return this.scan(this.clock.now(), request.force === true && only !== undefined, NIL_UUID, only)
    }

    /** One page of the keyset scan of the workspaces, then the pages after it. */
    private async scan(now: Date, force: boolean, after: string, only?: string): Promise<Array<TickDone>> {
        const page = await this.settings.tickWorkspaces(after, TICK_PAGE, only)
        const done: Array<TickDone> = []
        await eachInOrder(page, async (workspace) => {
            done.push(...(await this.runWorkspace(workspace, now, force)))
        })
        const last = page[page.length - 1]
        if (last === undefined || page.length < TICK_PAGE) return done
        return [...done, ...(await this.scan(now, force, last.workspaceId, only))]
    }

    private async runWorkspace(workspace: TickWorkspace, now: Date, force: boolean): Promise<Array<TickDone>> {
        const workspaceId = workspace.workspaceId
        const done: Array<TickDone> = []
        const record = (job: AutomationKey, count: number | null): void => {
            if (count === null) return
            done.push({ workspaceId, job, count })
            this.logger.info(ContentLogEvent.TickDone, { workspaceId, job, count })
        }
        try {
            if (workspace.automations.today_reminder === true)
                record("today_reminder", await this.todayReminder(workspace, now, force))
            if (workspace.automations.weekly_summary === true)
                record("weekly_summary", await this.weeklySummary(workspace, now, force))
            if (workspace.automations.offer_draft === true)
                record("offer_draft", await this.offerDraft(workspace, now, force))
        } catch (cause) {
            this.logger.error(ContentLogEvent.TickFailed, cause, { workspaceId })
        }
        return done
    }

    /** The reminder of what is due today; null when it is not due. */
    private async todayReminder(workspace: TickWorkspace, now: Date, force: boolean): Promise<number | null> {
        if (!isReminderDue(now, workspace.marks.reminder_day, force)) return null
        const workspaceId = workspace.workspaceId
        const window = dayWindow(now)
        const items = await this.items.listBetween(workspaceId, window.from, window.to)
        const due = items.filter((item) => item.status !== "published" && item.status !== "skipped")
        if (due.length > 0) {
            await this.notify(workspaceId, this.reminderBody(due))
            await this.entityManager.query(INSERT_EVIDENCE, [
                workspaceId,
                "content.reminder",
                this.text("content.reminder.evidence", { count: due.length }),
                vnDateKey(now),
            ])
        }
        await this.settings.mergeMarks(workspaceId, { reminder_day: vnDateKey(now) })
        return due.length
    }

    private reminderBody(due: ReadonlyArray<DueItem>): string {
        const lines = due.map((item) =>
            this.text("content.reminder.line", {
                time: item.scheduledAt === null ? "--:--" : hhmm(item.scheduledAt),
                channels: item.channels.map((channel) => this.text(`content.channel.${channel}`)).join(", "),
                title: item.title,
                status: this.text(`content.status.${item.status}`),
            }),
        )
        const notReady = due.filter((item) => item.status !== "approved").length
        const tail =
            notReady > 0
                ? this.text("content.reminder.notReady", { count: notReady })
                : this.text("content.reminder.allReady")
        return this.text("content.reminder.body", { count: due.length, lines: lines.join("\n"), tail })
    }

    /** The summary of last week's posts; null when it is not due. */
    private async weeklySummary(workspace: TickWorkspace, now: Date, force: boolean): Promise<number | null> {
        if (!isSummaryDue(now, workspace.marks.summary_week, force)) return null
        const workspaceId = workspace.workspaceId
        const window = lastWeekWindow(now)
        const items = await this.items.listBetween(workspaceId, window.from, window.to)
        const pillars = await this.entityManager.query<Array<PillarRow>>(SELECT_PILLARS, [workspaceId])
        await this.notify(workspaceId, this.summaryBody(items, pillars))
        await this.entityManager.query(INSERT_EVIDENCE, [
            workspaceId,
            "content.weekly_summary",
            this.text("content.summary.evidence", { count: items.length }),
            weekStartKey(now),
        ])
        await this.settings.mergeMarks(workspaceId, { summary_week: weekStartKey(now) })
        return items.length
    }

    private summaryBody(items: ReadonlyArray<DueItem>, pillars: ReadonlyArray<PillarRow>): string {
        if (items.length === 0) return this.text("content.summary.empty")
        const count = (status: string): number => items.filter((item) => item.status === status).length
        const byPillar = pillars
            .map((pillar) => ({
                name: pillar.name,
                count: items.filter((item) => item.pillarId === pillar.id && item.status !== "skipped").length,
            }))
            .filter((entry) => entry.count > 0)
        const missed = items.filter((item) => OPEN_STATUSES.includes(item.status)).length
        const lines = [
            this.text("content.summary.body", {
                total: items.length,
                published: count("published"),
                missed,
                skipped: count("skipped"),
            }),
            byPillar.length > 0
                ? this.text("content.summary.pillars", {
                      pillars: byPillar.map((entry) => `${entry.name} ${entry.count}`).join(", "),
                  })
                : "",
            missed > 0 ? this.text("content.summary.missed") : "",
        ]
        return lines.filter((line) => line !== "").join("\n")
    }

    /** The post ideas for new offers in the public knowledge; null when there is nothing to do. */
    private async offerDraft(workspace: TickWorkspace, now: Date, force: boolean): Promise<number | null> {
        const workspaceId = workspace.workspaceId
        const lastSeen = workspace.marks.offer_seen_at
        if (lastSeen === undefined && !force) {
            // The first run only remembers "now": offers that already existed when the owner switched this on are not turned into posts.
            await this.settings.mergeMarks(workspaceId, { offer_seen_at: now.toISOString() })
            return null
        }
        const sources = await this.entityManager.query<Array<FreshSourceRow>>(SELECT_FRESH_SOURCES, [
            workspaceId,
            lastSeen ?? new Date(0).toISOString(),
        ])
        const pattern = new RegExp(this.text("content.offer.pattern"), "iu")
        const fresh = sources
            .filter((source) => pattern.test(`${source.title} ${source.topic ?? ""} ${source.excerpt}`))
            .slice(0, OFFERS_PER_TICK)
        if (fresh.length === 0) return null
        const [pillars, cadence] = await Promise.all([
            this.entityManager.query<Array<PillarRow>>(SELECT_PILLARS, [workspaceId]),
            this.entityManager.query<Array<CadenceRow>>(SELECT_CADENCE_CHANNELS, [workspaceId]),
        ])
        const pillarPattern = new RegExp(this.text("content.offer.pillar"), "iu")
        const offerPillar = pillars.find((pillar) => pillar.active && pillarPattern.test(pillar.name))
        const channels = cadence.length > 0 ? cadence.map((entry) => entry.channel) : ["facebook"]
        let made = 0
        await eachInOrder(fresh, async (source) => {
            if (await this.ideaFor(workspaceId, source, offerPillar?.id ?? null, channels, now)) made += 1
        })
        // The mark moves forward only when every fresh source was handled; a failure above leaves it so the next tick tries again.
        const newest = fresh.reduce(
            (newest, source) => (Date.parse(source.changed_at) > Date.parse(newest) ? source.changed_at : newest),
            now.toISOString(),
        )
        await this.settings.mergeMarks(workspaceId, { offer_seen_at: newest })
        if (made > 0) await this.notify(workspaceId, this.text("content.offer.notice", { count: made }))
        return made
    }

    /** Writes the idea of a post about one source, unless an earlier tick already made it; true when a new idea was written. */
    private async ideaFor(
        workspaceId: string,
        source: FreshSourceRow,
        pillarId: string | null,
        channels: ReadonlyArray<string>,
        now: Date,
    ): Promise<boolean> {
        const title = this.text("content.offer.title", { title: source.title }).slice(0, 200)
        if (await this.items.hasOffer(workspaceId, title)) return false
        const line = {
            at: now.toISOString(),
            kind: "created",
            by: "NIVO",
            text: this.text("content.offer.evidence", { title: source.title }),
        }
        await this.items.createOfferIdea({
            workspaceId,
            title,
            brief: this.text("content.offer.brief", { title: source.title }),
            pillarId,
            channels,
            evidence: JSON.stringify([line]),
        })
        return true
    }

    private text(key: string, params: Record<string, string | number> = {}): string {
        return this.catalog.get(key, params, NOTICE_LOCALE)
    }

    private async notify(workspaceId: string, body: string): Promise<void> {
        await this.entityManager.query(INSERT_NOTICE, [workspaceId, body])
    }
}
