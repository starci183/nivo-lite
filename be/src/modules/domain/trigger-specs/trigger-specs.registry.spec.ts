import { readFileSync } from "node:fs"
import path from "node:path"
import { Test } from "@nestjs/testing"
import { TRIGGER_SOURCES, TRIGGER_SOURCE_KINDS, providerTriggerKeyOf, type TriggerSource } from "@nivo-lite/agent-sdk/graph"
import { PROVIDER, TRIGGER, type ProviderKey, type TriggerVerb } from "@nivo-lite/agent-sdk/names"
import { jsonTextOf } from "@tests/fixtures/builders/json-text.builder"
import {
    MAIL_RECEIVED,
    PROVIDER_TRIGGER_TAG_SOURCE,
    RENDER_COMPLETED,
    TRANSACTION_RECEIVED,
    providerTriggerLookup,
    triggersOf,
} from "@modules/domain/provider-triggers"
import { RENDER_COMPLETED as COMPOSE_RENDER_COMPLETED } from "@modules/domain/video-compose"
import { WEBSITE_LEAD_TAG_SOURCE } from "@modules/domain/inbox-leads/website-lead-wake.policy"
import { ENGINE_ROAD } from "./trigger-specs.contracts"
import {
    adaptersOf,
    eventKeyOf,
    sourcesOfTrigger,
    subjectOfEvent,
    suppliesOfAdapter,
    suppliesOfVerb,
    suppliesOfSource,
    verbOfProviderTrigger,
    verbOfSource,
    verbOfWake,
    wrappedTriggersOf,
} from "./trigger-specs.policy"
import { TRIGGERS } from "./trigger-specs.registry"
import { sourceStreamOf, streamOf } from "./trigger-streams.policy"

/**
 * The trigger registry agrees with what it wraps: every source kind of `TRIGGER_SOURCES` and every provider trigger of
 * `PROVIDER_TRIGGERS` is carried by exactly one verb; what each adapter supplies is exactly its catalogues' members; the `triggers`
 * table of `scripts/tool-rename-20261112.json` maps every one of its keys to the verb the registry does; the names written in the
 * registry are their owners' (the provider trigger names, the system tag sources).
 */

interface Subject {
    readonly triggers: typeof TRIGGERS
    readonly verbOfSource: typeof verbOfSource
    readonly verbOfWake: typeof verbOfWake
    readonly eventKeyOf: typeof eventKeyOf
}

const SUBJECT = Symbol("trigger-specs")

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { triggers: TRIGGERS, verbOfSource, verbOfWake, eventKeyOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const VERBS: ReadonlyArray<TriggerVerb> = Object.values(TRIGGER)

/** Every source of today the registry carries, with its verb. */
const carried = (registry: typeof TRIGGERS): ReadonlyArray<readonly [TriggerVerb, TriggerSource]> =>
    Object.values(registry).flatMap((spec) =>
        spec.adapters.flatMap((adapter) => adapter.sources.map((source) => [spec.verb, source] as const)),
    )

const keyOfSource = (source: TriggerSource): string =>
    source.kind === "provider" ? `provider:${source.provider ?? ""}:${source.trigger ?? ""}` : source.kind

describe("the trigger registry", () => {
    it("is total over TRIGGER, each spec under its own verb, every adapter carried by at least one source", async () => {
        const { triggers } = await build()
        expect(Object.keys(triggers).sort()).toEqual([...VERBS].sort())
        for (const [verb, spec] of Object.entries(triggers)) {
            expect(spec.verb).toBe(verb)
            expect(spec.adapters.length).toBeGreaterThan(0)
        }
    })

    it("carries every source kind of TRIGGER_SOURCES (but `provider` and the retired `sepay`) and every declared provider trigger exactly once", async () => {
        const { triggers } = await build()
        const keys = carried(triggers).map(([, source]) => keyOfSource(source))
        const declared = Object.values(PROVIDER).flatMap((provider) =>
            triggersOf(provider).map((declaration) => `provider:${declaration.provider}:${declaration.name}`),
        )
        // Ledger (TOOLS-LEAD W2): the core bank road (`kind: sepay`, tag `bank_feed`) left the registry: no producer wrote it any more. The
        // @1 kind stays readable in a stored document and is served by no verb (a trigger of it takes no wake).
        const kinds = TRIGGER_SOURCE_KINDS.filter((kind) => kind !== "provider" && kind !== "sepay")
        expect([...keys].sort()).toEqual([...kinds, ...declared].sort())
    })

    it("supplies exactly what the wrapped catalogues declare, an adapter of two roads what both guarantee", async () => {
        const { triggers } = await build()
        for (const [, source] of carried(triggers)) {
            const expected =
                source.kind === "provider"
                    ? providerTriggerLookup(providerTriggerKeyOf(source.provider ?? "", source.trigger ?? ""))?.supplies
                    : TRIGGER_SOURCES[source.kind].supplies
            expect(expected).toBeDefined()
            expect(suppliesOfSource(source)).toEqual(expected)
        }
        // SePay is a bank feed like the others: its provider trigger alone, so it supplies what Casso's does.
        const [sepay] = adaptersOf(TRIGGER.paymentCreditReceived, [PROVIDER.sepay])
        const [casso] = adaptersOf(TRIGGER.paymentCreditReceived, [PROVIDER.casso])
        expect(sepay?.sources.map(keyOfSource)).toEqual(["provider:sepay:transaction.received"])
        expect(sepay === undefined ? [] : suppliesOfAdapter(sepay)).toEqual(casso === undefined ? null : suppliesOfAdapter(casso))
        const [website] = adaptersOf(TRIGGER.websiteMessageReceived, undefined)
        expect(website === undefined ? [] : suppliesOfAdapter(website)).toEqual(TRIGGER_SOURCES.website.supplies)
        // The generic scope of the one event pipeline (ROAD-API 3.1): the form's own members are `data` members.
        expect(website === undefined ? [] : suppliesOfAdapter(website).map((param) => param.name)).toEqual([
            "eventId",
            "accountId",
            "contactId",
            "routeId",
            "subject",
            "data",
            "locale",
        ])
        const [zalo] = adaptersOf(TRIGGER.zaloMessageReceived, [PROVIDER.zaloOa])
        expect(zalo === undefined ? [] : suppliesOfAdapter(zalo)).toEqual(TRIGGER_SOURCES.zalo.supplies)
        const [telegram] = adaptersOf(TRIGGER.telegramMessageReceived, [PROVIDER.telegram])
        expect(telegram === undefined ? [] : suppliesOfAdapter(telegram)).toEqual(TRIGGER_SOURCES.telegram.supplies)
    })

    it("serves no verb of every customer channel (R6, gone at the flip): each channel's source is carried by its own verb alone", async () => {
        const { triggers, verbOfSource: of } = await build()
        expect(Object.keys(triggers)).not.toContain("nivo.trigger.lead.message.received")
        const message = carried(triggers).filter(([, source]) => ["zalo", "telegram", "website"].includes(keyOfSource(source)))
        expect(message.map(([verb, source]) => [keyOfSource(source), verb])).toEqual([
            ["zalo", TRIGGER.zaloMessageReceived],
            ["telegram", TRIGGER.telegramMessageReceived],
            ["website", TRIGGER.websiteMessageReceived],
        ])
        for (const [verb, source] of message) expect(of(source)).toBe(verb)
    })

    it("agrees with the triggers table of scripts/tool-rename-20261112.json, key by key", async () => {
        const { triggers } = await build()
        const file = path.resolve(__dirname, "../../../../../scripts/tool-rename-20261112.json")
        const table: unknown = jsonTextOf(readFileSync(file, "utf8"))
        const rows: unknown = typeof table === "object" && table !== null ? Reflect.get(table, "triggers") : null
        expect(typeof rows === "object" && rows !== null).toBe(true)
        const byKey = new Map(carried(triggers).map(([verb, source]) => [keyOfSource(source), verb]))
        const entries = Object.entries(typeof rows === "object" && rows !== null ? rows : {})
        expect(entries.length).toBeGreaterThan(0)
        // Ledger (TOOLS-LEAD W2): the table's `sepay` row renames the retired core bank road's kind; the registry carries it no more (its
        // credits come through the SePay provider trigger, of the same verb), so the row is checked against that verb's provider road.
        for (const [key, verb] of entries) {
            const carriedAs = key === "sepay" ? byKey.get("provider:sepay:transaction.received") : byKey.get(key)
            expect([key, carriedAs]).toEqual([key, verb])
        }
    })

    it("writes the provider trigger names and system tag sources their owners declare", async () => {
        const { triggers } = await build()
        const names = new Set(
            Object.values(triggers).flatMap((spec) => spec.adapters.flatMap((adapter) => wrappedTriggersOf(adapter).map((one) => one.name))),
        )
        expect([...names].sort()).toEqual([MAIL_RECEIVED, RENDER_COMPLETED, TRANSACTION_RECEIVED].sort())
        // The compose purpose's intake fires the very name the provider trigger catalogue declares.
        expect(RENDER_COMPLETED).toBe(COMPOSE_RENDER_COMPLETED)
        const tags = Object.values(triggers)
            .flatMap((spec) => spec.adapters.flatMap((adapter) => adapter.tagSource ?? []))
        // Ledger: billing's bank feed flow (the owner of `bank_feed`) was deleted with the money strip, and the core bank road left the
        // registry with it (TOOLS-LEAD W2): no tag source of a bank credit is declared any more.
        // Ledger (ROAD Opus-1d, 2026-11-14): the care timer's tag writer (`timerTagOf`, `CARE_SOURCE`) is deleted (a due timer is the
        // `timer.due` event of the one pipeline); the registry's adapter still names the tag source, so the spec names it as written there.
        expect([...tags].sort()).toEqual([WEBSITE_LEAD_TAG_SOURCE, "care-timer"].sort())
    })

    it("maps verb ↔ (provider, trigger_name): the stored switch names stay the provider's event names", () => {
        const wrapped = Object.values(TRIGGERS).flatMap((spec) =>
            spec.adapters.flatMap((adapter) => wrappedTriggersOf(adapter).map((one) => [spec.verb, `${one.provider}:${one.name}`] as const)),
        )
        expect(wrapped).toEqual([
            [TRIGGER.paymentCreditReceived, "sepay:transaction.received"],
            [TRIGGER.paymentCreditReceived, "casso:transaction.received"],
            [TRIGGER.paymentCreditReceived, "payos:transaction.received"],
            [TRIGGER.mailMessageReceived, "imap:mail.received"],
            [TRIGGER.videoRenderCompleted, "shotstack:render.completed"],
            [TRIGGER.videoRenderCompleted, "creatomate:render.completed"],
            [TRIGGER.videoRenderCompleted, "json2video:render.completed"],
        ])
        for (const [verb, key] of wrapped) expect(verbOfProviderTrigger(key)).toBe(verb)
        expect(verbOfProviderTrigger("sepay:nothing.here")).toBeNull()
    })

    it("validates each verb's args: the clock takes a preset and a time of day, every other verb takes none", () => {
        expect(TRIGGERS[TRIGGER.clockTick].args.safeParse({ preset: "weekdays_at", at: "09:00" }).success).toBe(true)
        expect(TRIGGERS[TRIGGER.clockTick].args.safeParse({ preset: "evening" }).success).toBe(true)
        expect(TRIGGERS[TRIGGER.clockTick].args.safeParse({ at: "09:00" }).success).toBe(false)
        expect(TRIGGERS[TRIGGER.clockTick].args.safeParse({ preset: "daily_at", at: "9h" }).success).toBe(false)
        expect(TRIGGERS[TRIGGER.clockTick].args.safeParse({ preset: "daily_at", at: "09:00:00" }).success).toBe(false)
        expect(TRIGGERS[TRIGGER.timerDue].args.safeParse({}).success).toBe(true)
        expect(TRIGGERS[TRIGGER.timerDue].args.safeParse({ preset: "x" }).success).toBe(false)
    })

    it("supplies on a due timer the item it is for and the data it carries back, beside the step, the record and the moment", () => {
        const [timer] = adaptersOf(TRIGGER.timerDue, undefined)
        // The generic scope of the one event pipeline (ROAD-API 3.1): the timer's own members are `data` members, its armed record
        // `data.data` (an open record), the person the arm had at the top.
        expect(timer === undefined ? [] : suppliesOfAdapter(timer)).toEqual(TRIGGER_SOURCES.timer.supplies)
        const data = timer === undefined ? undefined : suppliesOfAdapter(timer).find((param) => param.name === "data")
        expect(data?.members?.map((member) => member.name)).toEqual(["taskId", "ref", "dueAt", "careKind", "suffix", "item", "data"])
        expect(data?.members?.find((member) => member.name === "data")?.open).toBe("scalars")
    })

    it("says which events carry the message and which ids only (ruling B5)", () => {
        const messages = Object.values(TRIGGERS).filter((spec) => spec.payload === "message").map((spec) => spec.verb)
        expect(messages).toEqual([
            TRIGGER.zaloMessageReceived,
            TRIGGER.telegramMessageReceived,
            TRIGGER.facebookMessageReceived,
            TRIGGER.instagramMessageReceived,
            TRIGGER.websiteMessageReceived,
            TRIGGER.chatMessageReceived,
        ])
        expect(Object.values(TRIGGERS).filter((spec) => spec.supply === "caller").map((spec) => spec.verb)).toEqual([TRIGGER.workflowCalled])
    })
})

/** The Meta verbs, written out: the registry serves each Meta channel under its own verb, provider `meta`. */
const FACEBOOK: TriggerVerb = TRIGGER.facebookMessageReceived
const INSTAGRAM: TriggerVerb = TRIGGER.instagramMessageReceived

describe("Meta: each Meta channel its own verb, provider meta, received by the channel intake", () => {
    it("lists the Meta channel's source for provider meta, none for another provider, none with no provider", () => {
        const sources = (verb: TriggerVerb, providers?: ReadonlyArray<ProviderKey>): ReadonlyArray<string> =>
            sourcesOfTrigger(verb, providers).map(keyOfSource)
        expect(sources(FACEBOOK, [PROVIDER.meta])).toEqual(["facebook"])
        expect(sources(INSTAGRAM, [PROVIDER.meta])).toEqual(["instagram"])
        expect(sources(FACEBOOK, [PROVIDER.zaloOa])).toEqual([])
        expect(sources(FACEBOOK)).toEqual([])
        expect(adaptersOf(FACEBOOK, [PROVIDER.meta]).map((adapter) => adapter.receivedBy)).toEqual(["channel"])
    })

    it("gives each Meta channel's source its verb and supplies the channel members, as Zalo's", async () => {
        const { verbOfSource: of } = await build()
        expect(of({ kind: "facebook", connectionId: null })).toBe(FACEBOOK)
        expect(of({ kind: "instagram", connectionId: null })).toBe(INSTAGRAM)
        const [facebook] = adaptersOf(FACEBOOK, [PROVIDER.meta])
        const [zalo] = adaptersOf(TRIGGER.zaloMessageReceived, [PROVIDER.zaloOa])
        expect(facebook === undefined ? [] : suppliesOfAdapter(facebook)).toEqual(zalo === undefined ? null : suppliesOfAdapter(zalo))
        const [instagram] = adaptersOf(INSTAGRAM, [PROVIDER.meta])
        expect(facebook === undefined ? [] : suppliesOfAdapter(facebook)).toEqual(TRIGGER_SOURCES.facebook.supplies)
        expect(instagram === undefined ? [] : suppliesOfAdapter(instagram)).toEqual(TRIGGER_SOURCES.instagram.supplies)
        expect([TRIGGER_SOURCES.facebook.connectionKind, TRIGGER_SOURCES.instagram.connectionKind]).toEqual([PROVIDER.meta, PROVIDER.meta])
        expect([facebook?.provider, instagram?.provider]).toEqual([PROVIDER.meta, PROVIDER.meta])
    })
})

describe("the lookups", () => {
    it("lists the sources of one trigger per provider in order, the engine road with none, nothing for a provider that does not serve", () => {
        const sources = (verb: TriggerVerb, providers?: ReadonlyArray<ProviderKey>): ReadonlyArray<string> =>
            sourcesOfTrigger(verb, providers).map(keyOfSource)
        expect(sources(TRIGGER.paymentCreditReceived, [PROVIDER.casso, PROVIDER.sepay])).toEqual([
            "provider:casso:transaction.received",
            "provider:sepay:transaction.received",
        ])
        expect(sources(TRIGGER.zaloMessageReceived, [PROVIDER.meta])).toEqual([])
        expect(sources(TRIGGER.zaloMessageReceived, [PROVIDER.zaloOa])).toEqual(["zalo"])
        expect(sources(TRIGGER.zaloMessageReceived, [PROVIDER.telegram])).toEqual([])
        expect(sources(TRIGGER.zaloMessageReceived)).toEqual([])
        expect(sources(TRIGGER.telegramMessageReceived, [PROVIDER.telegram])).toEqual(["telegram"])
        expect(sources(TRIGGER.websiteMessageReceived)).toEqual(["website"])
        expect(sources(TRIGGER.websiteMessageReceived, [PROVIDER.zaloOa])).toEqual([])
        expect(sources(TRIGGER.timerDue)).toEqual(["timer"])
        expect(adaptersOf(TRIGGER.clockTick, undefined).map((adapter) => adapter.provider)).toEqual([ENGINE_ROAD])
    })

    it("gives every source of today its verb", async () => {
        const { verbOfSource: of } = await build()
        expect(of({ kind: "zalo", connectionId: null })).toBe(TRIGGER.zaloMessageReceived)
        expect(of({ kind: "telegram", connectionId: null })).toBe(TRIGGER.telegramMessageReceived)
        expect(of({ kind: "website", connectionId: null })).toBe(TRIGGER.websiteMessageReceived)
        // The retired core bank road: a stored @1 kind no verb serves.
        expect(of({ kind: "sepay", connectionId: null })).toBeNull()
        expect(of({ kind: "provider", connectionId: "c1", provider: "casso", trigger: "transaction.received" })).toBe(
            TRIGGER.paymentCreditReceived,
        )
        expect(of({ kind: "provider", connectionId: null, provider: "imap", trigger: "mail.received" })).toBe(TRIGGER.mailMessageReceived)
        expect(of({ kind: "provider", connectionId: null, provider: "imap", trigger: "nothing" })).toBeNull()
        expect(of({ kind: "workflow", connectionId: null })).toBe(TRIGGER.workflowCalled)
    })
})

describe("render completion: ONE generic verb, whichever compose provider rendered", () => {
    const COMPOSERS: ReadonlyArray<ProviderKey> = [PROVIDER.shotstack, PROVIDER.creatomate, PROVIDER.json2video]

    it("is served by each compose provider's webhook trigger `render.completed`, on the provider road, ids and the closed status", () => {
        const adapters = adaptersOf(TRIGGER.videoRenderCompleted, COMPOSERS)
        expect(adapters.map((adapter) => [adapter.provider, adapter.receivedBy, adapter.road, adapter.sources.map(keyOfSource)])).toEqual(
            COMPOSERS.map((provider) => [provider, "webhook", "system-event", [`provider:${provider}:render.completed`]]),
        )
        expect(TRIGGERS[TRIGGER.videoRenderCompleted]).toMatchObject({ payload: "ids", supply: "fixed", subject: ["renderId"] })
        for (const provider of COMPOSERS) expect(verbOfProviderTrigger(`${provider}:render.completed`)).toBe(TRIGGER.videoRenderCompleted)
    })

    it("supplies the row id, the render id and the status, and DECLARES the output, the error and the provider filled from the render row", () => {
        for (const adapter of adaptersOf(TRIGGER.videoRenderCompleted, COMPOSERS)) {
            // Ledger (ROAD Opus-1f, R44): the provider event is the generic scope; its own fields are `data`'s members.
            const supplied = suppliesOfVerb(TRIGGER.videoRenderCompleted, adapter)
            // Ledger (E-RED 2026-11-14): the DECLARED members (output, error, provider) are members of `data` too: the render's translate
            // puts them there and the flow fills nothing at the top of a pipeline event, so the lookup no longer lists them at the top.
            expect(supplied.find((param) => param.name === "data")?.members?.map((member) => member.name)).toEqual([
                "renderRowId",
                "renderId",
                "status",
                "outputUrl",
                "error",
                "provider",
            ])
            expect(supplied.map((param) => param.name)).toEqual(["eventId", "accountId", "data", "locale"])
        }
        expect(TRIGGERS[TRIGGER.videoRenderCompleted].reads).toMatchObject({ member: "renderRowId", purpose: "video.render" })
    })

    it("names its subject by the render id and keys one event by the render row, whichever webhook delivery brought it", async () => {
        const { eventKeyOf: of } = await build()
        expect(subjectOfEvent(TRIGGER.videoRenderCompleted, { renderId: "r-1", renderRowId: "row-1" })).toEqual({ member: "renderId", id: "r-1" })
        const scope = { source: PROVIDER_TRIGGER_TAG_SOURCE, providerTrigger: "creatomate:render.completed", renderRowId: "row-1", renderId: "r-1" }
        expect(of({ road: "system-event", scope, wakeEventKey: "provider:…" })).toBe("render:row-1")
    })

    it("reads the stream of each compose account as the account itself: no two accounts ever share one (nothing to pick)", () => {
        for (const provider of COMPOSERS) {
            expect(streamOf(TRIGGER.videoRenderCompleted, provider, {})).toBeNull()
            expect(sourceStreamOf(TRIGGER.videoRenderCompleted, provider, "c-1", { account_id: "same" })).toBe("connection:c-1")
            expect(sourceStreamOf(TRIGGER.videoRenderCompleted, provider, "c-2", { account_id: "same" })).toBe("connection:c-2")
        }
    })
})

describe("verbOfWake: the verb from what a wake already holds", () => {
    it.each<readonly [string, Parameters<typeof verbOfWake>[0], TriggerVerb | null]>([
        ["a Zalo line", { road: "channel", scope: { channel: "zalo" } }, TRIGGER.zaloMessageReceived],
        ["a Telegram line", { road: "channel", scope: { channel: "telegram" } }, TRIGGER.telegramMessageReceived],
        ["a channel line that names no channel: no verb, it starts nothing", { road: "channel", scope: {} }, null],
        ["a channel line that names only its channel event: no verb (the producer names the channel)", { road: "channel", scope: { channelEventId: "zalo:1" } }, null],
        ["a Facebook line (Meta)", { road: "channel", scope: { channel: "facebook" } }, FACEBOOK],
        ["an Instagram line (Meta)", { road: "channel", scope: { channel: "instagram" } }, INSTAGRAM],
        ["a line of a channel no verb serves: no verb", { road: "channel", scope: { channel: "email" } }, null],
        ["a clock slot", { road: "schedule", scope: { slot: "1" } }, TRIGGER.clockTick],
        ["a team chat line", { road: "chats-group", scope: {} }, TRIGGER.chatMessageReceived],
        ["a hand-off or an agent tag", { road: "agent", scope: {} }, TRIGGER.workflowCalled],
        ["the retired core bank road's tag: no verb", { road: "system-event", scope: { source: "bank_feed" } }, null],
        [
            "a bank feed provider trigger",
            { road: "system-event", scope: { source: PROVIDER_TRIGGER_TAG_SOURCE, providerTrigger: "casso:transaction.received" } },
            TRIGGER.paymentCreditReceived,
        ],
        [
            "the mailbox",
            { road: "system-event", scope: { source: PROVIDER_TRIGGER_TAG_SOURCE, providerTrigger: "imap:mail.received" } },
            TRIGGER.mailMessageReceived,
        ],
        [
            "a compose provider's render completion",
            { road: "system-event", scope: { source: PROVIDER_TRIGGER_TAG_SOURCE, providerTrigger: "json2video:render.completed" } },
            TRIGGER.videoRenderCompleted,
        ],
        ["a website order", { road: "system-event", scope: { source: "website_lead" } }, TRIGGER.websiteMessageReceived],
        ["a care timer", { road: "system-event", scope: { source: "care-timer" } }, TRIGGER.timerDue],
        ["an internal wake: no verb, it starts nothing", { road: "system-event", scope: { source: "system-event" } }, null],
        ["another system's tag: no verb", { road: "system-event", scope: { source: "booking_reminder" } }, null],
    ])("%s", async (_label, wake, verb) => {
        const subject = await build()
        expect(subject.verbOfWake(wake)).toBe(verb)
    })
})

describe("eventKeyOf: ONE normalised key per event, whichever road brought it", () => {
    // Ledger (TOOLS-LEAD W2): the core-road half left with the core bank road; a credit is keyed by its record on the one road it has.
    it("keys a bank credit by its payment.transaction record, whichever bank feed's provider trigger brought it", async () => {
        const { eventKeyOf: of } = await build()
        const credit = (provider: string): string =>
            of({
                road: "system-event",
                scope: { source: PROVIDER_TRIGGER_TAG_SOURCE, providerTrigger: `${provider}:transaction.received`, transactionId: "tx-1" },
                wakeEventKey: `provider:conn-1:${provider}:transaction.received:SP123:agent-2`,
            })
        expect(credit("sepay")).toBe("credit:tx-1")
        expect(credit("casso")).toBe("credit:tx-1")
    })

    it("keys a mail batch by its span on the account; the same batch is the same event, another batch another one", async () => {
        const { eventKeyOf: of } = await build()
        const batch = (ids: ReadonlyArray<string>): string =>
            of({
                road: "system-event",
                scope: { providerTrigger: "imap:mail.received", connectionId: "m1", eventIds: ids, count: ids.length },
                wakeEventKey: "provider:…",
            })
        expect(batch(["a", "b", "c"])).toBe("mail:m1:a..c#3")
        expect(batch(["a"])).toBe("mail:m1:a")
        expect(batch(["c", "d"])).not.toBe(batch(["a", "b", "c"]))
    })

    it("keeps the wake's own key for an event of one road, and where a member the rule reads is missing", async () => {
        const { eventKeyOf: of } = await build()
        expect(of({ road: "channel", scope: {}, wakeEventKey: "msg-9" })).toBe("msg-9")
        expect(of({ road: "schedule", scope: {}, wakeEventKey: "trig:1700" })).toBe("trig:1700")
        expect(of({ road: "system-event", scope: { source: "bank_feed" }, wakeEventKey: "bank-feed:c:e" })).toBe("bank-feed:c:e")
        expect(of({ road: "system-event", scope: { source: "x" }, wakeEventKey: "k" })).toBe("k")
    })
})

describe("the subject of an event: what the verb declares, read as data", () => {
    it("every member a fixed verb names as its subject is supplied by each of its adapters", () => {
        for (const spec of Object.values(TRIGGERS).filter((one) => one.supply === "fixed")) {
            for (const adapter of spec.adapters) {
                // A generic member is a top member; an event's own member is in `data` (one pipeline, R44): either supplies it.
                const params = suppliesOfAdapter(adapter)
                const inData = params.find((param) => param.name === "data")?.members ?? []
                const supplied = new Set([...params.map((param) => param.name), ...inData.map((member) => member.name)])
                for (const member of spec.subject) expect([spec.verb, member, supplied.has(member)]).toEqual([spec.verb, member, true])
            }
        }
    })

    it("names the first declared member the scope holds; none for a verb that declares none or a scope that holds none", () => {
        // A channel line names its person by the contact, else by the route (the generic scope; ROAD-API 3.1).
        expect(subjectOfEvent(TRIGGER.zaloMessageReceived, { routeId: "r-1", contactId: "p-1" })).toEqual({ member: "contactId", id: "p-1" })
        expect(subjectOfEvent(TRIGGER.zaloMessageReceived, { routeId: "r-1", contactId: "" })).toEqual({ member: "routeId", id: "r-1" })
        expect(subjectOfEvent(TRIGGER.workflowCalled, { conversationId: "c-1" })).toEqual({ member: "conversationId", id: "c-1" })
        expect(subjectOfEvent(TRIGGER.paymentCreditReceived, { transactionId: "t-1" })).toEqual({ member: "transactionId", id: "t-1" })
        expect(subjectOfEvent(TRIGGER.clockTick, { contactId: "p-1" })).toBeNull()
        expect(subjectOfEvent(TRIGGER.websiteMessageReceived, {})).toBeNull()
        expect(subjectOfEvent("no.such.verb", { contactId: "p-1" })).toBeNull()
    })
})
