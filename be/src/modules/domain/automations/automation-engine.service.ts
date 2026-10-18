import { Injectable } from "@nestjs/common"
import { AutomationPipelinesService } from "@modules/domain/automation-pipelines"
import { AutomationRunsService } from "@modules/domain/automation-runs"
import type { ClaimedRun, RunStep } from "@modules/domain/automation-runs"
import { AutomationTemplatesService } from "@modules/domain/automation-templates"
import type { TemplateDefinition } from "@modules/domain/automation-templates"
import { N8nDataService, N8nRunsService } from "@modules/domain/n8n-runs"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { AutomationCareExecutorsService } from "./automation-care-executors.service"
import { AutomationExtensionsService } from "./automation-extensions.service"
import { AutomationOperationsExecutorsService } from "./automation-operations-executors.service"
import type { AutomationOffice, ExecutorContext, OptionalExecutor, ScanContext } from "./automation-ports.contracts"
import { AutomationScansService } from "./automation-scans.service"
import { AutomationShopService } from "./automation-shop.service"
import type {
    BusinessEvent,
    EventData,
    FireTemplate,
    LoadedPipeline,
    ShopWithHours,
    TextParams,
    TickResult,
} from "./automations.contracts"
import { InjectAutomationOffice } from "./automations.decorators"
import { AutomationsLogEvent } from "./automations.log-events"
import { resolveConfig } from "./policies/config.policy"
import { planDecision, writeOf } from "./policies/pipeline.policy"
import { BATCH, planN8nSchedule } from "./policies/scan.policy"
import type { ScanPlan, ScanPlans } from "./policies/scan.policy"
import { DAY_MS, planTrigger, textOf } from "./policies/trigger.policy"
import type { TriggerPlan } from "./policies/trigger.policy"

const TICK_BUDGET_MS = 25_000
const FIRE_DELAY_MS = 5000
const FEEDBACK_WINDOW_DAYS = 7

@Injectable()
/**
 * The automations engine. Two ways in: `onBusinessEvent`, called right after a business write, evaluates the workspace's pipelines
 * that are on for that event (idempotent: a dedupe key is unique per trigger); `runTick`, called every minute by the tick queue,
 * runs due and retried runs, the scans of the templates that look at the data on a clock, and the ticks of the extensions.
 * Nothing here talks to a customer directly: executors go through the authority gate.
 */
export class AutomationEngineService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        @InjectAutomationOffice() private readonly office: AutomationOffice,
        private readonly templates: AutomationTemplatesService,
        private readonly pipelines: AutomationPipelinesService,
        private readonly runs: AutomationRunsService,
        private readonly shop: AutomationShopService,
        private readonly scans: AutomationScansService,
        private readonly care: AutomationCareExecutorsService,
        private readonly operations: AutomationOperationsExecutorsService,
        private readonly extensions: AutomationExtensionsService,
        private readonly n8nRuns: N8nRunsService,
        private readonly n8nData: N8nDataService,
    ) {}

    /** Evaluates the pipelines of a workspace that are on for a business event. */
    async onBusinessEvent(event: BusinessEvent): Promise<void> {
        const { workspaceId, data } = event
        if (event.event === "decision.made") {
            await this.onDecision(workspaceId, data)
            return
        }
        await this.startN8nEvents(event)
        const loaded = await this.loadPipelines(workspaceId)
        if (loaded.length === 0) return
        const shop = await this.shop.shopOf(workspaceId)
        const at = this.clock.now()
        await eachInOrder(loaded, async (item) => {
            try {
                const plan = planTrigger({
                    templateKey: item.def.key,
                    event: event.event,
                    data,
                    dedupe: event.dedupe,
                    config: item.config,
                    at,
                    shop,
                })
                if (plan !== null) await this.start(item, shop, plan)
            } catch (cause) {
                this.logger.error(AutomationsLogEvent.EventFailed, cause, {
                    template: item.def.key,
                    event: event.event,
                })
            }
        })
        if (event.event === "message.inbound") await this.onFeedback(loaded, shop, data)
    }

    /**
     * Starts the customer's receipt by email for a reconciled payment, when the shop switched the receipt pipeline on; only the
     * receipt, not the other pipelines that hear a payment. One receipt per transaction (or per invoice without one).
     */
    async startPaymentReceipt(
        workspaceId: string,
        transactionId: string | null,
        invoiceId: string | null,
    ): Promise<void> {
        await this.startN8nEvents({
            workspaceId,
            event: "payment.received",
            data: { transaction_id: transactionId, invoice_id: invoiceId },
            dedupe: `receipt:${transactionId ?? invoiceId ?? ""}`,
        })
    }

    /** Starts one run of a template for ONE workspace from code (a loyalty tier-up fires this); a no-op when its pipeline is off. */
    async fireTemplate(request: FireTemplate): Promise<boolean> {
        const item = (await this.loadPipelines(request.workspaceId)).find(
            (candidate) => candidate.def.key === request.templateKey,
        )
        if (item === undefined) return false
        const shop = await this.shop.shopOf(request.workspaceId)
        // Written now and executed on a later tick, not inside the request or tick that fired it.
        await this.start(item, shop, {
            dedupe: request.dedupe,
            triggerRef: request.triggerRef,
            payload: request.payload,
            delayMs: FIRE_DELAY_MS,
        })
        return true
    }

    /** The minute tick at the current instant: what the tick job of the queue runs. */
    tickNow(): Promise<TickResult> {
        return this.runTick(this.clock.now())
    }

    /** The minute tick: due and retried runs, then the scans and the extension ticks, inside a time budget. */
    async runTick(now: Date): Promise<TickResult> {
        const deadline = this.clock.now().getTime() + TICK_BUDGET_MS
        const inBudget = (): boolean => this.clock.now().getTime() < deadline
        const loaded = await this.loadPipelines()
        const shops = new Map<string, ShopWithHours>()
        const shopOf = async (workspaceId: string): Promise<ShopWithHours> => {
            const known = shops.get(workspaceId)
            if (known !== undefined) return known
            const fresh = await this.shop.shopOf(workspaceId)
            shops.set(workspaceId, fresh)
            return fresh
        }
        let runs = 0
        await eachInOrder(loaded, async (item) => {
            if (inBudget()) runs += await this.runDue(item, await shopOf(item.pipeline.workspace_id), now)
        })
        runs += await this.extensions.tick(now)
        await eachInOrder(loaded, async (item) => {
            if (!inBudget()) return
            try {
                runs += await this.scan(item, await shopOf(item.pipeline.workspace_id), now)
            } catch (cause) {
                this.logger.error(AutomationsLogEvent.ScanFailed, cause, { template: item.def.key })
            }
        })
        runs += await this.scheduleN8n(now)
        return { pipelines: loaded.length, runs }
    }

    /* ------------------------------------------------------------------ events */

    /** A customer replied after a review request: a negative answer tags the owner in Office (once per request). */
    private async onFeedback(
        loaded: ReadonlyArray<LoadedPipeline>,
        shop: ShopWithHours,
        data: EventData,
    ): Promise<void> {
        const item = loaded.find((candidate) => candidate.def.key === "ask_review")
        const leadId = textOf(data.lead_id)
        if (item === undefined || !leadId) return
        const run = await this.runs.latestDoneRun({
            pipelineId: item.pipeline.id,
            reference: leadId,
            since: new Date(this.clock.now().getTime() - FEEDBACK_WINDOW_DAYS * DAY_MS).toISOString(),
        })
        if (run === null || run.payload.alerted) return
        await this.care.checkFeedback({
            context: this.contextOf(item, shop),
            runId: run.id,
            runPayload: run.payload,
            feedback: textOf(data.text),
            leadId,
        })
    }

    /** The owner decided a work item: the automation run that waited for it ends, and the trust ladder moves. */
    private async onDecision(workspaceId: string, data: EventData): Promise<void> {
        const itemId = textOf(data.work_item_id)
        if (!itemId) return
        const outcome = textOf(data.outcome)
        const rejected = outcome === "rejected"
        const waiting = await this.runs.waitingRunsFor(workspaceId, itemId)
        await eachInOrder(waiting, async (run) => {
            const answer: RunStep = {
                label: this.say(this.decisionKey(outcome)),
                status: rejected ? "skipped" : "done",
                workItemId: itemId,
            }
            await this.runs.settleRun({
                runId: run.id,
                status: rejected ? "skipped" : "done",
                steps: [...run.steps.filter((step) => step.status !== "waiting"), answer],
                evidence: this.say("decision.evidence", { by: textOf(data.decided_by), outcome }),
            })
            const pipeline = await this.pipelines.findPipelineById(run.pipeline_id)
            if (pipeline === null) return
            const { write, offered } = planDecision(writeOf(pipeline), outcome, this.clock.now().toISOString())
            await this.pipelines.saveLadder(pipeline.id, write.approvalStreak, write.trustOfferedAt)
            if (offered) {
                await this.office.logEvidence(workspaceId, {
                    kind: "automation.trust_offered",
                    actor: "NIVO",
                    summary: this.say("decision.trustOffered", { name: pipeline.name, streak: write.approvalStreak }),
                    evidence: String(write.approvalStreak),
                })
            }
        })
    }

    private decisionKey(outcome: string): string {
        if (outcome === "rejected") return "decision.rejected"
        return outcome === "edited" ? "decision.edited" : "decision.approved"
    }

    /** Starts the n8n workflows an event triggers; the payment receipt is the only one today. */
    private async startN8nEvents(event: BusinessEvent): Promise<void> {
        const items = (await this.loadN8nPipelines(event.workspaceId)).filter(
            (item) => item.def.key === "email-payment-receipt" && item.def.trigger.event === event.event,
        )
        await eachInOrder(items, async (item) => {
            try {
                const receipt = await this.n8nData.paymentReceipt(
                    event.workspaceId,
                    textOf(event.data.transaction_id),
                    textOf(event.data.invoice_id),
                )
                if (receipt !== null) await this.startN8n(item, receipt.data, receipt.dedupe)
            } catch (cause) {
                this.logger.error(AutomationsLogEvent.EventFailed, cause, {
                    template: item.def.key,
                    event: event.event,
                })
            }
        })
    }

    /* ------------------------------------------------------------------ runs */

    private loadPipelines(workspaceId?: string): Promise<ReadonlyArray<LoadedPipeline>> {
        return this.loadOf("implemented", workspaceId)
    }

    private loadN8nPipelines(workspaceId?: string): Promise<ReadonlyArray<LoadedPipeline>> {
        return this.loadOf("n8n", workspaceId)
    }

    private async loadOf(
        executor: TemplateDefinition["executor"],
        workspaceId?: string,
    ): Promise<ReadonlyArray<LoadedPipeline>> {
        const [rows, templates] = await Promise.all([
            workspaceId === undefined
                ? this.pipelines.enabledPipelines()
                : this.pipelines.enabledPipelinesOf(workspaceId),
            this.templates.listTemplates(),
        ])
        return rows.flatMap((pipeline) => {
            const def = templates.find((template) => template.key === pipeline.template_key)
            return def?.executor === executor ? [{ pipeline, def, config: resolveConfig(def, pipeline.config) }] : []
        })
    }

    private contextOf(item: LoadedPipeline, shop: ShopWithHours): ExecutorContext {
        return {
            workspaceId: item.pipeline.workspace_id,
            pipeline: item.pipeline,
            def: item.def,
            config: item.config,
            body: item.pipeline.body ?? item.def.defaultBody?.vi ?? "",
            shop,
        }
    }

    private executorOf(templateKey: string): OptionalExecutor {
        return (
            this.care.executors()[templateKey] ??
            this.operations.executors()[templateKey] ??
            this.extensions.executorOf(templateKey)
        )
    }

    /** Records a trigger and, unless it is scheduled for later or already ran, executes it now. */
    private async start(item: LoadedPipeline, shop: ShopWithHours, plan: TriggerPlan): Promise<void> {
        const executor = this.executorOf(item.def.key)
        if (executor === undefined) return
        const run = await this.runs.beginRun({
            pipelineId: item.pipeline.id,
            workspaceId: item.pipeline.workspace_id,
            dedupe: plan.dedupe,
            triggerRef: plan.triggerRef,
            payload: plan.payload,
            runAt: plan.delayMs > 0 ? new Date(this.clock.now().getTime() + plan.delayMs) : undefined,
        })
        if (run !== null) await this.execute(item, shop, run, executor)
    }

    private async execute(
        item: LoadedPipeline,
        shop: ShopWithHours,
        run: ClaimedRun,
        executor: NonNullable<OptionalExecutor>,
    ): Promise<void> {
        const context = this.contextOf(item, shop)
        await this.runs.executeRun(run, () => executor(context, run.payload))
    }

    /** Executes the runs of a pipeline that are due: queued for later, or failed and ready for another attempt. */
    private async runDue(item: LoadedPipeline, shop: ShopWithHours, now: Date): Promise<number> {
        const executor = this.executorOf(item.def.key)
        if (executor === undefined) return 0
        const ids = await this.runs.dueRunIds(item.pipeline.id, now, BATCH)
        let executed = 0
        await eachInOrder(ids, async (id) => {
            const claimed = await this.runs.claimRun(id)
            if (claimed === null) return
            await this.execute(item, shop, claimed, executor)
            executed += 1
        })
        return executed
    }

    /* ------------------------------------------------------------------ scans */

    /** The scan of a template that looks at the data on a clock; answers how many runs it started. */
    private async scan(item: LoadedPipeline, shop: ShopWithHours, now: Date): Promise<number> {
        const context: ScanContext = {
            ...this.contextOf(item, shop),
            now,
            batch: BATCH,
            trigger: (dedupe, triggerRef, payload) =>
                this.start(item, shop, { dedupe, triggerRef, payload, delayMs: 0 }),
        }
        const extended = await this.extensions.scan(context)
        if (extended !== null) return extended
        return this.startPlans(item, shop, await this.scans.planScan(item, now, BATCH))
    }

    private async startPlans(item: LoadedPipeline, shop: ShopWithHours, plans: ScanPlans): Promise<number> {
        await eachInOrder(plans.runs, (plan: ScanPlan) => this.start(item, shop, { ...plan, delayMs: 0 }))
        await eachInOrder(plans.events, (announcement) =>
            this.onBusinessEvent({
                workspaceId: item.pipeline.workspace_id,
                event: "contract.expiring",
                data: announcement.data,
                dedupe: announcement.dedupe,
            }),
        )
        return plans.runs.length + plans.events.length
    }

    /** Starts the scheduled n8n workflows that are due: a daily report in the three hours after its time, a monthly ledger on the first day. */
    private async scheduleN8n(now: Date): Promise<number> {
        const items = (await this.loadN8nPipelines()).filter((item) => item.def.trigger.kind === "schedule")
        let started = 0
        await eachInOrder(items, async (item) => {
            const plan = planN8nSchedule(item.def.trigger.event, item.config, now)
            if (plan === null) return
            try {
                if ((await this.startN8n(item, plan.data, plan.dedupe)) !== null) started += 1
            } catch (cause) {
                this.logger.error(AutomationsLogEvent.ScanFailed, cause, { template: item.def.key })
            }
        })
        return started
    }

    private startN8n(item: LoadedPipeline, data: EventData, dedupe: string): Promise<string | null> {
        return this.n8nRuns.startRun({
            workspaceId: item.pipeline.workspace_id,
            templateKey: item.def.key,
            webhookPath: item.def.n8n?.webhook ?? item.def.key,
            config: { ...item.config, ...(item.pipeline.body ? { body: item.pipeline.body } : {}) },
            data,
            dedupe,
        })
    }

    /** The Vietnamese text of a key. */
    private say(key: string, params: TextParams = {}): string {
        return this.catalog.get(`automations.${key}`, params, "vi")
    }
}
