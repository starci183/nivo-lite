import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import { ContentItemsService } from "@modules/domain/content-items"
import type { DueItem } from "@modules/domain/content-items"
import { ContentSettingsService } from "@modules/domain/content-settings"
import type { TickWorkspace } from "@modules/domain/content-settings"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ContentService } from "./content.service"
import { ContentLogEvent } from "./content.log-events"
import { INSERT_NOTICE, SELECT_CADENCE_CHANNELS, SELECT_FRESH_SOURCES, SELECT_PILLARS } from "./persistence/content.sql"

/** Monday 12 October 2026, 09:30 in Vietnam. */
const registerRunTick = () => {
    describe("runTick", () => {
        it("does nothing when no workspace has an automation on", async () => {
            const { content, settings } = await build(mockEntityManager())

            await expect(content.runTick({})).resolves.toEqual([])

            expect(settings.tickWorkspaces).toHaveBeenCalledWith("00000000-0000-0000-0000-000000000000", 200, undefined)
        })

        it("honours force only for the one workspace it is asked about", async () => {
            const { content, settings, items } = await build(
                mockEntityManager({
                    query: [[INSERT_NOTICE, []]],
                }),
            )
            settings.tickWorkspaces.mockResolvedValue([
                workspaceOf({ automations: { today_reminder: true }, marks: { reminder_day: "2026-10-12" } }),
            ])
            items.listBetween.mockResolvedValue([itemOf()])

            const forced = await content.runTick({ workspaceId: "workspace-1", force: true })
            const ignored = await content.runTick({ force: true })

            expect(forced).toEqual([{ workspaceId: "workspace-1", job: "today_reminder", count: 1 }])
            expect(ignored).toEqual([])
            expect(settings.tickWorkspaces).toHaveBeenCalledWith(
                "00000000-0000-0000-0000-000000000000",
                200,
                "workspace-1",
            )
        })

        it("reads every page of workspaces", async () => {
            const { content, settings } = await build(mockEntityManager())
            const full = Array.from({ length: 200 }, (_unused, index) =>
                workspaceOf({ workspaceId: `workspace-${index}` }),
            )
            settings.tickWorkspaces
                .mockResolvedValueOnce(full)
                .mockResolvedValueOnce([workspaceOf({ workspaceId: "workspace-last" })])

            await content.runTick({})

            expect(settings.tickWorkspaces).toHaveBeenNthCalledWith(2, "workspace-199", 200, undefined)
            expect(settings.tickWorkspaces).toHaveBeenCalledTimes(2)
        })

        it("logs a workspace that fails and still runs the next one", async () => {
            const { content, settings, items, logger } = await build(mockEntityManager())
            const failure = new Error("database down")
            settings.tickWorkspaces.mockResolvedValue([
                workspaceOf({ workspaceId: "bad", automations: { today_reminder: true } }),
                workspaceOf({ workspaceId: "good", automations: { today_reminder: true } }),
            ])
            items.listBetween.mockRejectedValueOnce(failure).mockResolvedValueOnce([])

            const done = await content.runTick({})

            expect(done).toEqual([{ workspaceId: "good", job: "today_reminder", count: 0 }])
            expect(logger.error).toHaveBeenCalledWith(ContentLogEvent.TickFailed, failure, { workspaceId: "bad" })
        })
    })

    describe("today reminder", () => {
        registerReminderContents()
        registerEmptyReminder()
    })
}

const registerWeeklySummary = () => {
    describe("weekly summary", () => {
        registerSummaryContents()
        registerEmptySummary()
    })

    describe("offer ideas", () => {
        registerOfferDiscovery()
        registerOfferProgress()
        registerOfferTopics()
    })
}

const registerReminderContents = () => {
    it("tells what is due today, how many are not approved, and remembers the day", async () => {
        const em = mockEntityManager({
            query: [[INSERT_NOTICE, []]],
        })
        const { content, settings, items, events } = await build(em)
        settings.tickWorkspaces.mockResolvedValue([reminderOf()])
        items.listBetween.mockResolvedValue([
            itemOf(),
            itemOf({
                id: "item-2",
                title: "Draft post",
                status: "draft",
                channels: ["facebook", "zalo"],
                scheduledAt: null,
            }),
            itemOf({ id: "item-3", status: "published" }),
            itemOf({ id: "item-4", status: "skipped" }),
        ])

        await expect(content.runTick({})).resolves.toEqual([
            { workspaceId: "workspace-1", job: "today_reminder", count: 2 },
        ])

        expect(items.listBetween).toHaveBeenCalledWith(
            "workspace-1",
            "2026-10-11T17:00:00.000Z",
            "2026-10-12T17:00:00.000Z",
        )
        const lines = [
            `content.reminder.line:${JSON.stringify({
                time: "11:00",
                channels: "content.channel.facebook:{}",
                title: "Opening",
                status: "content.status.approved:{}",
            })}`,
            `content.reminder.line:${JSON.stringify({
                time: "--:--",
                channels: "content.channel.facebook:{}, content.channel.zalo:{}",
                title: "Draft post",
                status: "content.status.draft:{}",
            })}`,
        ].join("\n")
        expect(em.query).toHaveBeenCalledWith(INSERT_NOTICE, [
            "workspace-1",
            `content.reminder.body:${JSON.stringify({
                count: 2,
                lines,
                tail: `content.reminder.notReady:${JSON.stringify({ count: 1 })}`,
            })}`,
        ])
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "workspace-1",
            kind: "content.reminder",
            actor: "NIVO",
            summary: 'content.reminder.evidence:{"count":2}',
        })
        expect(settings.mergeMarks).toHaveBeenCalledWith("workspace-1", { reminder_day: "2026-10-12" })
    })

    it("says everything is approved when it is", async () => {
        const em = mockEntityManager({
            query: [[INSERT_NOTICE, []]],
        })
        const { content, settings, items } = await build(em)
        settings.tickWorkspaces.mockResolvedValue([reminderOf()])
        items.listBetween.mockResolvedValue([itemOf()])

        await content.runTick({})

        expect(em.query).toHaveBeenCalledWith(INSERT_NOTICE, [
            "workspace-1",
            expect.stringContaining('"tail":"content.reminder.allReady:{}"'),
        ])
    })
}

const registerEmptyReminder = () => {
    it("writes nothing but the mark when nothing is due", async () => {
        const em = mockEntityManager()
        const { content, settings } = await build(em)
        settings.tickWorkspaces.mockResolvedValue([reminderOf()])

        await expect(content.runTick({})).resolves.toEqual([
            { workspaceId: "workspace-1", job: "today_reminder", count: 0 },
        ])

        expect(em.query).not.toHaveBeenCalled()
        expect(settings.mergeMarks).toHaveBeenCalledWith("workspace-1", { reminder_day: "2026-10-12" })
    })

    it("does not repeat itself on the same day", async () => {
        const { content, settings, items } = await build(mockEntityManager())
        settings.tickWorkspaces.mockResolvedValue([reminderOf({ reminder_day: "2026-10-12" })])

        await expect(content.runTick({})).resolves.toEqual([])

        expect(items.listBetween).not.toHaveBeenCalled()
    })
}

const registerSummaryContents = () => {
    it("summarises last week by status and by theme", async () => {
        const em = mockEntityManager({
            query: [
                [
                    SELECT_PILLARS,
                    [
                        { id: "pillar-1", name: "Products", active: true },
                        { id: "pillar-2", name: "Unused", active: true },
                    ],
                ],
                [INSERT_NOTICE, []],
            ],
        })
        const { content, settings, items } = await build(em)
        settings.tickWorkspaces.mockResolvedValue([summaryOf()])
        items.listBetween.mockResolvedValue([
            itemOf({ status: "published", pillarId: "pillar-1" }),
            itemOf({ id: "item-2", status: "draft", pillarId: "pillar-1" }),
            itemOf({ id: "item-3", status: "skipped", pillarId: "pillar-1" }),
        ])

        await expect(content.runTick({})).resolves.toEqual([
            { workspaceId: "workspace-1", job: "weekly_summary", count: 3 },
        ])

        expect(items.listBetween).toHaveBeenCalledWith(
            "workspace-1",
            "2026-10-04T17:00:00.000Z",
            "2026-10-11T17:00:00.000Z",
        )
        const summary = 'content.summary.body:{"total":3,"published":1,"missed":1,"skipped":1}'
        const pillars = 'content.summary.pillars:{"pillars":"Products 2"}'
        expect(em.query).toHaveBeenCalledWith(INSERT_NOTICE, [
            "workspace-1",
            [summary, pillars, "content.summary.missed:{}"].join("\n"),
        ])
        expect(settings.mergeMarks).toHaveBeenCalledWith("workspace-1", { summary_week: "2026-10-12" })
    })

    it("leaves out the theme and missed lines when there is nothing to say", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_PILLARS, []],
                [INSERT_NOTICE, []],
            ],
        })
        const { content, settings, items } = await build(em)
        settings.tickWorkspaces.mockResolvedValue([summaryOf()])
        items.listBetween.mockResolvedValue([itemOf({ status: "published" })])

        await content.runTick({})

        expect(em.query).toHaveBeenCalledWith(INSERT_NOTICE, [
            "workspace-1",
            'content.summary.body:{"total":1,"published":1,"missed":0,"skipped":0}',
        ])
    })
}

const registerEmptySummary = () => {
    it("says so when no post was scheduled", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_PILLARS, []],
                [INSERT_NOTICE, []],
            ],
        })
        const { content, settings } = await build(em)
        settings.tickWorkspaces.mockResolvedValue([summaryOf()])

        await content.runTick({})

        expect(em.query).toHaveBeenCalledWith(INSERT_NOTICE, ["workspace-1", "content.summary.empty:{}"])
    })

    it("waits for Monday and does not repeat itself in the same week", async () => {
        const { content, settings, items } = await build(mockEntityManager())
        settings.tickWorkspaces.mockResolvedValue([summaryOf({ summary_week: "2026-10-12" })])

        await expect(content.runTick({})).resolves.toEqual([])

        expect(items.listBetween).not.toHaveBeenCalled()
    })
}

const registerOfferDiscovery = () => {
    it("only remembers now on the first run", async () => {
        const em = mockEntityManager()
        const { content, settings } = await build(em)
        settings.tickWorkspaces.mockResolvedValue([offerOf()])

        await expect(content.runTick({})).resolves.toEqual([])

        expect(settings.mergeMarks).toHaveBeenCalledWith("workspace-1", { offer_seen_at: MONDAY })
        expect(em.query).not.toHaveBeenCalled()
    })

    it("makes an idea for each new offer, notifies the owner and moves the mark", async () => {
        const em = mockEntityManager({
            query: [
                [
                    SELECT_FRESH_SOURCES,
                    [SOURCE, { ...SOURCE, id: "source-2", title: "Weather report", excerpt: "Sunny" }],
                ],
                [
                    SELECT_PILLARS,
                    [
                        { id: "pillar-1", name: "Products", active: true },
                        { id: "pillar-2", name: "Special offer", active: true },
                    ],
                ],
                [SELECT_CADENCE_CHANNELS, [{ channel: "zalo" }]],
                [INSERT_NOTICE, []],
            ],
        })
        const { content, settings, items } = await build(em)
        settings.tickWorkspaces.mockResolvedValue([offerOf({ offer_seen_at: "2026-10-12T00:00:00.000Z" })])

        await expect(content.runTick({})).resolves.toEqual([
            { workspaceId: "workspace-1", job: "offer_draft", count: 1 },
        ])

        expect(em.query).toHaveBeenCalledWith(SELECT_FRESH_SOURCES, ["workspace-1", "2026-10-12T00:00:00.000Z"])
        expect(items.hasOffer).toHaveBeenCalledWith("workspace-1", 'content.offer.title:{"title":"Big offer"}')
        expect(items.createOfferIdea).toHaveBeenCalledWith({
            workspaceId: "workspace-1",
            title: 'content.offer.title:{"title":"Big offer"}',
            brief: 'content.offer.brief:{"title":"Big offer"}',
            pillarId: "pillar-2",
            channels: ["zalo"],
            evidence: JSON.stringify([
                { at: MONDAY, kind: "created", by: "NIVO", text: 'content.offer.evidence:{"title":"Big offer"}' },
            ]),
        })
        expect(settings.mergeMarks).toHaveBeenCalledWith("workspace-1", { offer_seen_at: MONDAY })
        expect(em.query).toHaveBeenCalledWith(INSERT_NOTICE, ["workspace-1", 'content.offer.notice:{"count":1}'])
    })
}

const registerOfferProgress = () => {
    it("leaves the mark at the newest source when it is later than now, and posts to Facebook by default", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FRESH_SOURCES, [{ ...SOURCE, changed_at: "2026-10-12T05:00:00.000000Z" }]],
                [SELECT_PILLARS, []],
                [SELECT_CADENCE_CHANNELS, []],
                [INSERT_NOTICE, []],
            ],
        })
        const { content, settings, items } = await build(em)
        settings.tickWorkspaces.mockResolvedValue([offerOf({ offer_seen_at: "2026-10-12T00:00:00.000Z" })])

        await content.runTick({})

        expect(items.createOfferIdea).toHaveBeenCalledWith(
            expect.objectContaining({ pillarId: null, channels: ["facebook"] }),
        )
        expect(settings.mergeMarks).toHaveBeenCalledWith("workspace-1", {
            offer_seen_at: "2026-10-12T05:00:00.000000Z",
        })
    })

    it("does not make an idea twice and does not notify when nothing new was made", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FRESH_SOURCES, [SOURCE]],
                [SELECT_PILLARS, []],
                [SELECT_CADENCE_CHANNELS, []],
            ],
        })
        const { content, settings, items } = await build(em)
        settings.tickWorkspaces.mockResolvedValue([offerOf({ offer_seen_at: "2026-10-12T00:00:00.000Z" })])
        items.hasOffer.mockResolvedValue(true)

        await expect(content.runTick({})).resolves.toEqual([
            { workspaceId: "workspace-1", job: "offer_draft", count: 0 },
        ])

        expect(items.createOfferIdea).not.toHaveBeenCalled()
        expect(em.query).not.toHaveBeenCalledWith(INSERT_NOTICE, expect.anything())
    })

    it("does nothing when no new source talks about an offer", async () => {
        const em = mockEntityManager({
            query: [SELECT_FRESH_SOURCES, [{ ...SOURCE, title: "Weather", excerpt: "Sunny" }]],
        })
        const { content, settings, items } = await build(em)
        settings.tickWorkspaces.mockResolvedValue([offerOf({ offer_seen_at: "2026-10-12T00:00:00.000Z" })])

        await expect(content.runTick({})).resolves.toEqual([])

        expect(items.createOfferIdea).not.toHaveBeenCalled()
        expect(settings.mergeMarks).not.toHaveBeenCalled()
    })

    it("looks at every source when an operator forces a first run", async () => {
        const em = mockEntityManager({ query: [SELECT_FRESH_SOURCES, []] })
        const { content, settings } = await build(em)
        settings.tickWorkspaces.mockResolvedValue([offerOf()])

        await content.runTick({ workspaceId: "workspace-1", force: true })

        expect(em.query).toHaveBeenCalledWith(SELECT_FRESH_SOURCES, ["workspace-1", "1970-01-01T00:00:00.000Z"])
    })
}

const registerOfferTopics = () => {
    it("matches an offer by its topic too", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_FRESH_SOURCES, [{ ...SOURCE, title: "News", topic: "Summer sale", excerpt: "x" }]],
                [SELECT_PILLARS, []],
                [SELECT_CADENCE_CHANNELS, []],
                [INSERT_NOTICE, []],
            ],
        })
        const { content, settings, items } = await build(em)
        settings.tickWorkspaces.mockResolvedValue([offerOf({ offer_seen_at: "2026-10-12T00:00:00.000Z" })])

        await content.runTick({})

        expect(items.createOfferIdea).toHaveBeenCalledTimes(1)
    })
}

const reminderOf = (marks = {}) => workspaceOf({ automations: { today_reminder: true }, marks })

const summaryOf = (marks = {}) => workspaceOf({ automations: { weekly_summary: true }, marks })

const offerOf = (marks = {}) => workspaceOf({ automations: { offer_draft: true }, marks })

const MONDAY = "2026-10-12T02:30:00.000Z"

const PATTERNS: Record<string, string> = { "content.offer.pattern": "offer|sale", "content.offer.pillar": "offer" }

const workspaceOf = builder<TickWorkspace>({ workspaceId: "workspace-1", automations: {}, marks: {} })

const itemOf = builder<DueItem>({
    id: "item-1",
    title: "Opening",
    status: "approved",
    channels: ["facebook"],
    scheduledAt: "2026-10-12T04:00:00.000Z",
    pillarId: null,
})

const SOURCE = {
    id: "source-1",
    title: "Big offer",
    topic: null,
    excerpt: "A real offer for you",
    changed_at: "2026-10-12T01:00:00.123456Z",
}

const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => PATTERNS[key] ?? `${key}:${JSON.stringify(params)}`)
    const items = mock<ContentItemsService>()
    const settings = mock<ContentSettingsService>()
    const events = mock<EventsService>()
    const logger = mock<Logger>()
    items.listBetween.mockResolvedValue([])
    items.hasOffer.mockResolvedValue(false)
    items.createOfferIdea.mockResolvedValue("item-9")
    settings.tickWorkspaces.mockResolvedValue([])
    settings.mergeMarks.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: ContentItemsService, useValue: items },
            { provide: ContentSettingsService, useValue: settings },
            { provide: EventsService, useValue: events },
            { provide: CLOCK, useValue: new FakeClock(MONDAY) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { content: moduleRef.get(ContentService), items, settings, events, logger }
}

describe("ContentService", () => {
    registerRunTick()
    registerWeeklySummary()
})
