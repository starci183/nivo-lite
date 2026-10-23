import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import { AutomationPipelinesService } from "@modules/domain/automation-pipelines"
import { AutomationRunsService } from "@modules/domain/automation-runs"
import { AutomationTemplatesService } from "@modules/domain/automation-templates"
import type { TemplateDefinition } from "@modules/domain/automation-templates"
import { N8nRunsService } from "@modules/domain/n8n-runs"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { Logger } from "@modules/platform/logging"
import { AutomationEngineService } from "./automation-engine.service"
import { AutomationExtensionsService } from "./automation-extensions.service"
import type { AutomationOffice, AutomationText } from "./automation-ports.contracts"
import { AutomationShopService } from "./automation-shop.service"
import {
    PATTERNS,
    TEXT,
    buildOverviewRows,
    buildPipelineRow,
    buildRunRow,
    buildShop,
    buildTemplate,
} from "@tests/fixtures/builders/automations.builder"
import { AUTOMATION_OFFICE, AUTOMATION_TEXT } from "./automations.decorators"
import { AutomationsLogEvent } from "./automations.log-events"
import { AutomationsService } from "./automations.service"
import { AutomationsErrorCode } from "./errors/automations.error"

const textLike = (text: string): unknown => expect.stringContaining(text)
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

const NOW = "2026-10-12T10:00:00.000Z"
const MEMBER: WorkspaceMember = {
    userId: "u-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Lan",
    status: "active",
}
const BODY = "Chao {ten_khach}, cam on ban"

const message = (): TemplateDefinition =>
    buildTemplate({
        settings: [{ key: "days", kind: "number", label: TEXT, min: 1, max: 9 }],
        defaults: { days: 3 },
        variables: ["ten_khach"],
        defaultBody: { vi: BODY, en: BODY },
        contentMode: "fixed",
    })

const build = async (def: TemplateDefinition = message()) => {
    const clock = new FakeClock(NOW)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}${JSON.stringify(params)}`)
    const logger = mock<Logger>()
    const office = mock<AutomationOffice>()
    office.logEvidence.mockResolvedValue()
    const text = mock<AutomationText>()
    text.generate.mockResolvedValue(null)
    const templates = mock<AutomationTemplatesService>()
    templates.templateOf.mockResolvedValue(def)
    templates.listTemplates.mockResolvedValue([def])
    const pipelines = mock<AutomationPipelinesService>()
    pipelines.findPipeline.mockResolvedValue(null)
    pipelines.pipelineKeys.mockResolvedValue([{ id: "p-1", template_key: def.key }])
    const runs = mock<AutomationRunsService>()
    runs.runsOf.mockResolvedValue([buildRunRow()])
    const shop = mock<AutomationShopService>()
    shop.overviewRows.mockResolvedValue(
        buildOverviewRows({ pipelines: [buildPipelineRow({ template_key: def.key, enabled: false })] }),
    )
    shop.contextsOf.mockReturnValue({ installed: [], versions: {}, text: "", hoursText: "", operatingModes: {} })
    shop.shopPatterns.mockReturnValue(PATTERNS)
    shop.labeller.mockReturnValue((kind, key) => ({ vi: `${kind}:${key}`, en: `${kind}:${key}` }))
    shop.shopFrom.mockReturnValue(buildShop())
    shop.shopOf.mockResolvedValue(buildShop())
    shop.sample.mockReturnValue({ variables: {}, neutral: {} })
    shop.contextFor.mockResolvedValue({ text: "We sell flowers", version: 2 })
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const extensions = mock<AutomationExtensionsService>()
    extensions.prepareEnable.mockImplementation((_w, _u, _d, config) => Promise.resolve(config))
    extensions.googleAccounts.mockResolvedValue([{ id: "g-1", email: "a@b.c", status: "active" }])
    const n8nRuns = mock<N8nRunsService>()
    const engine = mock<AutomationEngineService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationsService,
            { provide: CLOCK, useValue: clock },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: AUTOMATION_OFFICE, useValue: office },
            { provide: AUTOMATION_TEXT, useValue: text },
            { provide: AutomationTemplatesService, useValue: templates },
            { provide: AutomationPipelinesService, useValue: pipelines },
            { provide: AutomationRunsService, useValue: runs },
            { provide: AutomationShopService, useValue: shop },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AutomationExtensionsService, useValue: extensions },
            { provide: N8nRunsService, useValue: n8nRuns },
            { provide: AutomationEngineService, useValue: engine },
        ],
    }).compile()
    const service = moduleRef.get(AutomationsService)
    return { service, logger, office, text, templates, pipelines, runs, shop, members, extensions, n8nRuns, engine }
}

describe("AutomationsService overview", () => {
    it("assembles the cards, the history, the shop and the sample for an owner or manager", async () => {
        const { service, members } = await build()

        const overview = await service.overview("u-1", "ws-1")

        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1", ["owner", "manager"])
        expect(overview.cards.map((card) => card.key)).toEqual(["thank_payment"])
        expect(overview.shop).toEqual({ shop: "Tiem Hoa", hours: "08:00 - 21:00", tone: "than thien" })
        expect(overview.sample).toEqual({ variables: {}, neutral: {} })
        expect(overview.runs).toEqual([])
    })
})
describe("AutomationsService history", () => {
    it("lists the runs of the workspace, or of a template that has a pipeline", async () => {
        const { service, runs } = await build()

        const all = await service.history("u-1", "ws-1", "")
        const one = await service.history("u-1", "ws-1", "thank_payment")

        expect(all).toHaveLength(1)
        expect(one).toHaveLength(1)
        expect(runs.runsOf).toHaveBeenNthCalledWith(1, { workspaceId: "ws-1", templateKey: null, limit: 40 })
        expect(runs.runsOf).toHaveBeenNthCalledWith(2, {
            workspaceId: "ws-1",
            templateKey: "thank_payment",
            limit: 40,
        })
    })

    it("lists nothing for a template that was never switched", async () => {
        const { service, runs } = await build()

        await expect(service.history("u-1", "ws-1", "other_template")).resolves.toEqual([])

        expect(runs.runsOf).not.toHaveBeenCalled()
    })
})
describe("AutomationsService update", () => {
    it("refuses a request that changes nothing", async () => {
        const { service } = await build()

        await expect(service.update("u-1", "ws-1", "thank_payment", {})).rejects.toMatchObject({
            code: AutomationsErrorCode.NothingToChange,
        })
    })

    it("saves the settings and the wording and writes the audit lines", async () => {
        const { service, pipelines, office } = await build()

        const card = await service.update("u-1", "ws-1", "thank_payment", {
            values: { days: 7 },
            body: "Dear {ten_khach}, welcome",
        })

        expect(pipelines.savePipeline).toHaveBeenCalledWith(
            "ws-1",
            "u-1",
            expect.objectContaining({ key: "thank_payment" }),
            expect.objectContaining({
                config: { days: 7 },
                body: "Dear {ten_khach}, welcome",
                bodyVersion: 1,
                basedOnContext: 2,
            }),
        )
        expect(office.logEvidence).toHaveBeenCalledWith("ws-1", {
            kind: "automation.body_saved",
            actor: "Lan",
            summary: textLike("audit.bodySaved"),
            evidence: "Dear {ten_khach}, welcome",
        })
        expect(card.key).toBe("thank_payment")
    })

    it("hides a template", async () => {
        const { service, pipelines } = await build()

        await service.update("u-1", "ws-1", "thank_payment", { dismissed: true })

        expect(pipelines.savePipeline).toHaveBeenCalledWith(
            "ws-1",
            "u-1",
            expect.anything(),
            expect.objectContaining({ dismissed: true, enabled: false }),
        )
    })

    it("moves a spreadsheet to another Google account of the workspace", async () => {
        const sheet = buildTemplate({
            key: "sheet_orders",
            requires: { modules: [], channels: [], connections: ["google"], capabilities: [] },
        })
        const { service, pipelines } = await build(sheet)

        await service.update("u-1", "ws-1", "sheet_orders", { googleConnectionId: "g-1" })

        expect(pipelines.savePipeline).toHaveBeenCalledWith(
            "ws-1",
            "u-1",
            expect.anything(),
            objectLike({ config: objectLike({ googleConnectionId: "g-1" }) }),
        )
    })
})
describe("AutomationsService update", () => {
    it("answers an offer of sending by itself and records it", async () => {
        const { service, pipelines, office } = await build()
        pipelines.findPipeline.mockResolvedValue(
            buildPipelineRow({ trust_offered_at: "2026-10-01T00:00:00.000Z", approval_streak: 20 }),
        )

        await service.update("u-1", "ws-1", "thank_payment", { autoSend: true })
        await service.update("u-1", "ws-1", "thank_payment", { autoSend: false })

        expect(office.logEvidence).toHaveBeenNthCalledWith(
            1,
            "ws-1",
            expect.objectContaining({
                kind: "automation.auto_send_granted",
                evidence: 'automations.audit.streak{"count":20}',
            }),
        )
        expect(office.logEvidence).toHaveBeenNthCalledWith(
            2,
            "ws-1",
            expect.objectContaining({ kind: "automation.auto_send_declined" }),
        )
    })

    it("switches a template on once the shop meets what it needs, and lets the extensions prepare it", async () => {
        const { service, pipelines, extensions, office } = await build()
        extensions.prepareEnable.mockResolvedValue({ days: 3, spreadsheetId: "s-1" })

        await service.update("u-1", "ws-1", "thank_payment", { enabled: true })

        expect(extensions.prepareEnable).toHaveBeenCalledWith("ws-1", "u-1", expect.anything(), { days: 3 })
        expect(pipelines.savePipeline).toHaveBeenCalledWith(
            "ws-1",
            "u-1",
            expect.anything(),
            expect.objectContaining({ enabled: true, config: { days: 3, spreadsheetId: "s-1" }, body: BODY }),
        )
        expect(office.logEvidence).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({ kind: "automation.enabled", evidence: undefined }),
        )
    })

    it("refuses to switch on what the shop lacks", async () => {
        const needs = buildTemplate({
            requires: { modules: ["booking"], channels: [], connections: [], capabilities: [] },
        })
        const { service } = await build(needs)

        await expect(service.update("u-1", "ws-1", "thank_payment", { enabled: true })).rejects.toMatchObject({
            code: AutomationsErrorCode.RequirementMissing,
        })
    })

    it("switches a template off without checking anything", async () => {
        const { service, pipelines, extensions } = await build()

        await service.update("u-1", "ws-1", "thank_payment", { enabled: false })

        expect(extensions.prepareEnable).not.toHaveBeenCalled()
        expect(pipelines.savePipeline).toHaveBeenCalledWith(
            "ws-1",
            "u-1",
            expect.anything(),
            expect.objectContaining({ enabled: false }),
        )
    })
})
describe("AutomationsService update", () => {
    it("logs an audit line that cannot be written and still answers", async () => {
        const { service, office, logger } = await build()
        const failure = new Error("office down")
        office.logEvidence.mockRejectedValue(failure)

        await expect(service.update("u-1", "ws-1", "thank_payment", { enabled: false })).resolves.toMatchObject({
            key: "thank_payment",
        })

        expect(logger.error).toHaveBeenCalledWith(AutomationsLogEvent.AuditFailed, failure, {
            kind: "automation.disabled",
        })
    })

    it("fails when the card that was just saved is not in the gallery", async () => {
        const { service, templates } = await build()
        templates.listTemplates.mockResolvedValue([])

        await expect(service.update("u-1", "ws-1", "thank_payment", { dismissed: false })).rejects.toMatchObject({
            code: AutomationsErrorCode.NotSaved,
        })
    })
})
describe("AutomationsService emit", () => {
    it("lets any member tell the engine what happened", async () => {
        const { service, members, engine } = await build()

        await service.emit("u-1", "ws-1", { event: "payment.received", dedupe: "d-1", data: { a: 1 } })

        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
        expect(engine.onBusinessEvent).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            event: "payment.received",
            dedupe: "d-1",
            data: { a: 1 },
        })
    })
})
describe("AutomationsService googleAccounts", () => {
    it("lists the accounts the extensions know", async () => {
        const { service } = await build()

        await expect(service.googleAccounts("u-1", "ws-1")).resolves.toEqual([
            { id: "g-1", email: "a@b.c", status: "active" },
        ])
    })
})
describe("AutomationsService suggestFor", () => {
    it("proposes the applicable templates of a module that are off and not hidden", async () => {
        const { service } = await build()

        await expect(service.suggestFor("u-1", "ws-1", "sales")).resolves.toEqual([
            { key: "thank_payment", name: TEXT, reason: TEXT },
        ])
    })

    it("proposes the workspace-wide templates when no module is named, and nothing for another module", async () => {
        const wide = buildTemplate({ moduleKey: null })
        const { service } = await build(wide)

        await expect(service.suggestFor("u-1", "ws-1", "")).resolves.toHaveLength(1)
        await expect(service.suggestFor("u-1", "ws-1", "booking")).resolves.toEqual([])
    })

    it("leaves out what is on, hidden, coming soon or missing a requirement", async () => {
        const on = await build()
        on.shop.overviewRows.mockResolvedValue(buildOverviewRows({ pipelines: [buildPipelineRow()] }))
        const hidden = await build()
        hidden.shop.overviewRows.mockResolvedValue(
            buildOverviewRows({ pipelines: [buildPipelineRow({ enabled: false, dismissed: true })] }),
        )
        const soon = await build(buildTemplate({ executor: "definition" }))
        const missing = await build(
            buildTemplate({ requires: { modules: ["booking"], channels: [], connections: [], capabilities: [] } }),
        )

        for (const { service } of [on, hidden, soon, missing]) {
            await expect(service.suggestFor("u-1", "ws-1", "sales")).resolves.toEqual([])
        }
    })
})
describe("AutomationsService proposeBody", () => {
    it("uses the text the model wrote when it keeps the blanks and is plain", async () => {
        const { service, text } = await build()
        text.generate.mockResolvedValue('"Chao {ten_khach}, rat vui duoc phuc vu"')

        await expect(service.proposeBody("u-1", "ws-1", "thank_payment")).resolves.toEqual({
            body: "Chao {ten_khach}, rat vui duoc phuc vu",
            generated: true,
            contextVersion: 2,
        })

        expect(text.generate).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: "ws-1", purpose: "personalize" }),
        )
    })

    it("gives the standard wording when the model answers nothing or the text is not usable", async () => {
        const silent = await build()
        const dropped = await build()
        dropped.text.generate.mockResolvedValue("no blank here")

        for (const { service, text } of [silent, dropped]) {
            await expect(service.proposeBody("u-1", "ws-1", "thank_payment")).resolves.toEqual({
                body: BODY,
                generated: false,
                contextVersion: 2,
            })
            expect(text.generate).toHaveBeenCalledTimes(1)
        }

        const deterministic = await build(message())
        await expect(deterministic.service.proposeBody("u-1", "ws-1", "thank_payment")).resolves.toEqual({
            body: BODY,
            generated: false,
            contextVersion: 2,
        })
    })

    it("refuses a template that sends no message", async () => {
        const { service } = await build(buildTemplate())

        await expect(service.proposeBody("u-1", "ws-1", "thank_payment")).rejects.toMatchObject({
            code: AutomationsErrorCode.NoMessage,
        })
    })
})
describe("AutomationsService runNow", () => {
    const scheduled = (event: string): TemplateDefinition =>
        buildTemplate({
            key: "email-daily-report",
            executor: "n8n",
            trigger: { kind: "schedule", event, line: TEXT },
            n8n: { webhook: "nivo/daily", audience: "owner" },
        })
    it("starts a daily workflow for today", async () => {
        const { service, pipelines, n8nRuns } = await build(scheduled("schedule.daily"))
        pipelines.findPipeline.mockResolvedValue(buildPipelineRow({ config: { time: "08:00" }, body: "Mine" }))
        n8nRuns.startRun.mockResolvedValue("run-1")

        await service.runNow("u-1", "ws-1", "email-daily-report")

        expect(n8nRuns.startRun).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            templateKey: "email-daily-report",
            webhookPath: "nivo/daily",
            config: { time: "08:00", body: "Mine" },
            data: { date: "2026-10-12" },
            dedupe: `manual:${Date.parse(NOW)}`,
        })
    })

    it("starts a monthly workflow for the month before, without a body the owner did not approve", async () => {
        const { service, pipelines, n8nRuns } = await build(scheduled("schedule.monthly"))
        pipelines.findPipeline.mockResolvedValue(buildPipelineRow({ config: {} }))
        n8nRuns.startRun.mockResolvedValue("run-1")

        await service.runNow("u-1", "ws-1", "email-daily-report")

        expect(n8nRuns.startRun).toHaveBeenCalledWith(
            expect.objectContaining({ config: {}, data: { period: "2026-09" } }),
        )
    })

    it("refuses a template that cannot be run on demand", async () => {
        const notN8n = await build()
        const notScheduled = await build(buildTemplate({ executor: "n8n", n8n: { webhook: "w", audience: "owner" } }))
        const noWebhook = await build(
            buildTemplate({ executor: "n8n", trigger: { kind: "schedule", event: "schedule.daily", line: TEXT } }),
        )

        for (const { service } of [notN8n, notScheduled, noWebhook]) {
            await expect(service.runNow("u-1", "ws-1", "x")).rejects.toMatchObject({
                code: AutomationsErrorCode.RunNowUnavailable,
            })
        }
    })

    it("refuses when the pipeline is off or was never switched", async () => {
        const never = await build(scheduled("schedule.daily"))
        const off = await build(scheduled("schedule.daily"))
        off.pipelines.findPipeline.mockResolvedValue(buildPipelineRow({ enabled: false }))

        await expect(never.service.runNow("u-1", "ws-1", "x")).rejects.toMatchObject({
            code: AutomationsErrorCode.PipelineOff,
        })
        await expect(off.service.runNow("u-1", "ws-1", "x")).rejects.toMatchObject({
            code: AutomationsErrorCode.PipelineOff,
        })
    })

    it("fails when the run could not be queued", async () => {
        const { service, pipelines, n8nRuns } = await build(scheduled("schedule.daily"))
        pipelines.findPipeline.mockResolvedValue(buildPipelineRow())
        n8nRuns.startRun.mockResolvedValue(null)

        await expect(service.runNow("u-1", "ws-1", "x")).rejects.toMatchObject({
            code: AutomationsErrorCode.RunNotQueued,
        })
    })
})
