import {
    TEXT,
    buildFacts,
    buildInstallation,
    buildOverviewRows,
    buildPipelineRow,
    buildRunRow,
    buildTemplate,
} from "@tests/fixtures/builders/automations.builder"
import type { AutomationRunView } from "../automations.contracts"
import { buildCards, missingFor, runViewOf, runViewsOf } from "./cards.policy"
import type { CardInputs } from "./cards.policy"

const label = (kind: string, key: string) => ({ vi: `${kind}:${key}`, en: `${kind}:${key}` })

describe("missingFor", () => {
    const def = buildTemplate({
        requires: {
            modules: ["sales", "booking"],
            channels: ["customer_chat", "other"],
            connections: ["google", "smtp"],
            capabilities: ["has_deposits", "has_delivery"],
        },
    })

    it("lists each requirement the shop does not meet, with its label", () => {
        const facts = buildFacts({
            installed: ["sales"],
            hasChat: false,
            connections: [{ provider: "smtp", status: "active" }],
            capabilities: new Set(["has_delivery"]),
        })

        expect(missingFor(def, facts, label).map((item) => `${item.kind}:${item.key}:${item.label.vi}`)).toEqual([
            "module:booking:module:booking",
            "channel:customer_chat:channel:customer_chat",
            "connection:google:connection:google",
            "capability:has_deposits:capability:has_deposits",
        ])
    })

    it("lists nothing when the shop meets all of them", () => {
        const facts = buildFacts({
            installed: ["sales", "booking"],
            hasChat: true,
            connections: [
                { provider: "google", status: "active" },
                { provider: "smtp", status: "active" },
            ],
            capabilities: new Set(["has_deposits", "has_delivery"]),
        })

        expect(missingFor(def, facts, label)).toEqual([])
    })
})

describe("runViewOf", () => {
    it("shows the last detailed step as the summary, with the work item and the message", () => {
        const view = runViewOf(
            buildRunRow({
                steps: [
                    { label: "Soan tin", status: "done", detail: "xong", workItemId: "w-1", message: "Chao ban" },
                    { label: "Gui", status: "waiting" },
                ],
                evidence: "vi sao",
            }),
            "thank_payment",
        )

        expect(view).toMatchObject({
            id: "r-1",
            pipelineId: "p-1",
            templateKey: "thank_payment",
            status: "done",
            summary: "Soan tin: xong",
            evidence: "vi sao",
            workItemId: "w-1",
            message: "Chao ban",
        })
        expect(view.steps).toEqual([
            { label: "Soan tin", status: "done", detail: "xong" },
            { label: "Gui", status: "waiting", detail: undefined },
        ])
    })

    it("falls back on the last step, then on the status, and knows no work item or message", () => {
        const withSteps = runViewOf(buildRunRow({ steps: [{ label: "Gui", status: "done" }] }), "k")
        const empty = runViewOf(buildRunRow({ status: "queued" }), "k")

        expect(withSteps).toMatchObject({ summary: "Gui", workItemId: null, message: null })
        expect(empty.summary).toBe("queued")
    })

    it("shows a row with no steps as an empty history", () => {
        const view = runViewOf(buildRunRow({ steps: null, status: "failed" }), "k")

        expect(view).toMatchObject({ status: "failed", summary: "failed", steps: [] })
    })
})

describe("runViewsOf", () => {
    it("shows the runs of pipelines whose template key is well-formed", () => {
        const views = runViewsOf(
            [
                buildRunRow({ id: "r-1", pipeline_id: "p-1" }),
                buildRunRow({ id: "r-2", pipeline_id: "p-2" }),
                buildRunRow({ id: "r-3", pipeline_id: "p-3" }),
            ],
            [
                { id: "p-1", template_key: "thank_payment" },
                { id: "p-2", template_key: "Bad Key" },
            ],
        )

        expect(views.map((view) => `${view.id}:${view.templateKey}`)).toEqual(["r-1:thank_payment"])
    })
})

describe("buildCards", () => {
    const runs: ReadonlyArray<AutomationRunView> = [
        { ...runViewOf(buildRunRow({ id: "r-9", created_at: "2026-10-05T00:00:00.000Z" }), "thank_payment") },
        { ...runViewOf(buildRunRow({ id: "r-8" }), "other_template") },
    ]

    const inputs = (overrides: Partial<CardInputs>): CardInputs => ({
        rows: buildOverviewRows(),
        templates: [buildTemplate()],
        contexts: { installed: [], versions: {}, text: "", hoursText: "", operatingModes: {} },
        facts: buildFacts(),
        runs: [],
        label,
        ...overrides,
    })

    it("builds the card of a template that was never switched", () => {
        const [card] = buildCards(inputs({}))

        expect(card).toMatchObject({
            key: "thank_payment",
            pipelineId: null,
            enabled: false,
            dismissed: false,
            body: null,
            bodyVersion: 0,
            basedOnContext: null,
            currentContext: null,
            bodyStale: false,
            gate: null,
            proposed: true,
            comingSoon: false,
            lastRunAt: null,
            runCount: 0,
            trust: { streak: 0, offered: false, autoSend: false },
        })
        expect(card).not.toHaveProperty("google")
    })

    it("builds the card of a switched pipeline with its history and trust ladder", () => {
        const row = buildPipelineRow({
            body: "Hello",
            body_version: 2,
            based_on_context: 3,
            approval_streak: 4,
            trust_offered_at: "2026-10-03T00:00:00.000Z",
            auto_send: false,
        })
        const [card] = buildCards(
            inputs({
                rows: buildOverviewRows({ pipelines: [row] }),
                contexts: { installed: ["sales"], versions: { sales: 5 }, text: "", hoursText: "", operatingModes: {} },
                runs,
            }),
        )

        expect(card).toMatchObject({
            pipelineId: "p-1",
            enabled: true,
            body: "Hello",
            bodyVersion: 2,
            basedOnContext: 3,
            currentContext: 5,
            bodyStale: true,
            lastRunAt: "2026-10-05T00:00:00.000Z",
            runCount: 1,
            trust: { streak: 4, offered: true, autoSend: false },
        })
    })

    it("does not call a wording stale when the context did not move, when none was recorded or when there is no wording", () => {
        const versions = { sales: 3 }
        const contexts = { installed: ["sales"], versions, text: "", hoursText: "", operatingModes: {} }
        const staleOf = (row: ReturnType<typeof buildPipelineRow>) =>
            buildCards(inputs({ rows: buildOverviewRows({ pipelines: [row] }), contexts }))[0]?.bodyStale

        expect(staleOf(buildPipelineRow({ body: "x", based_on_context: 3 }))).toBe(false)
        expect(staleOf(buildPipelineRow({ body: "x", based_on_context: null }))).toBe(false)
        expect(staleOf(buildPipelineRow({ body: null, based_on_context: 1 }))).toBe(false)
    })

    it("hides a capability-gated pack whose capability the shop lacks, and marks a template nothing runs yet", () => {
        const gated = buildTemplate({
            key: "extra_pack",
            pack: "email",
            requires: { modules: [], channels: [], connections: [], capabilities: ["has_deposits"] },
        })
        const coming = buildTemplate({ key: "soon_template", executor: "definition" })
        const core = buildTemplate({
            key: "core_pack",
            requires: { modules: [], channels: [], connections: [], capabilities: ["has_deposits"] },
        })
        const cards = buildCards(inputs({ templates: [gated, coming, core] }))

        expect(cards.map((card) => `${card.key}:${card.proposed}:${card.comingSoon}`)).toEqual([
            "extra_pack:false:false",
            "soon_template:true:true",
            "core_pack:true:false",
        ])
    })

    it("works out what happens to a customer message", () => {
        const rules = [{ department: "sales", action: "send_care", mode: "auto" as const }]
        const contexts = { installed: [], versions: {}, text: "", hoursText: "", operatingModes: { sales: "assist" } }
        const gates = buildCards(
            inputs({
                rows: buildOverviewRows({ rules }),
                contexts,
                templates: [
                    buildTemplate({ key: "always_ask", authority: { action: "send_care", alwaysAsk: true } }),
                    buildTemplate({ key: "by_rule", authority: { action: "send_care" } }),
                    buildTemplate({ key: "sends_none", authority: { action: null } }),
                ],
            }),
        ).map((card) => card.gate)

        expect(gates).toEqual(["ask", "ask", null])
    })

    describe("a template that writes to Google", () => {
        const sheet = buildTemplate({
            key: "sheet_orders",
            requires: { modules: [], channels: [], connections: ["google"], capabilities: [] },
        })
        const googleOf = (
            google: ReturnType<typeof buildOverviewRows>["google"],
            row?: ReturnType<typeof buildPipelineRow>,
        ) =>
            buildCards(
                inputs({
                    templates: [sheet],
                    rows: buildOverviewRows({ google, pipelines: row ? [row] : [] }),
                }),
            )[0]

        it("is missing before there is a connection or while it is pending", () => {
            expect(googleOf(null)).toMatchObject({ google: "missing", sheetUrl: null })
            expect(googleOf({ status: "pending", last_error: null, public_meta: null })).toMatchObject({
                google: "missing",
            })
        })

        it("is ready with the link of the spreadsheet, or with the link the settings kept", () => {
            expect(
                googleOf({ status: "active", last_error: null, public_meta: { sheet_url: "https://s/1" } }),
            ).toMatchObject({
                google: "ready",
                sheetUrl: "https://s/1",
            })
            expect(
                googleOf(
                    { status: "active", last_error: null, public_meta: null },
                    buildPipelineRow({ template_key: "sheet_orders", config: { sheetUrl: "https://s/2" } }),
                ),
            ).toMatchObject({ google: "ready", sheetUrl: "https://s/2" })
            expect(googleOf({ status: "active", last_error: null, public_meta: {} })).toMatchObject({ sheetUrl: null })
        })

        it("is lost after an error and unavailable when the consent was refused", () => {
            expect(googleOf({ status: "error", last_error: "boom", public_meta: null })).toMatchObject({
                google: "lost",
            })
            expect(googleOf({ status: "error", last_error: null, public_meta: null })).toMatchObject({ google: "lost" })
            expect(
                googleOf({ status: "error", last_error: "consent:denied", public_meta: { sheet_url: "https://s/3" } }),
            ).toMatchObject({ google: "unavailable", sheetUrl: "https://s/3" })
        })
    })

    it("uses the label of the missing requirement", () => {
        const needs = buildTemplate({
            requires: { modules: ["booking"], channels: [], connections: [], capabilities: [] },
        })
        const [card] = buildCards(
            inputs({ templates: [needs], rows: buildOverviewRows({ installations: [buildInstallation()] }) }),
        )

        expect(card?.missing[0]?.label).toEqual(label("module", "booking"))
        expect(TEXT.vi).toBe("Xin chao")
    })
})
