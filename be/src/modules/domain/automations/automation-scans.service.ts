import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AutomationRunsService } from "@modules/domain/automation-runs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { LoadedPipeline } from "./automations.contracts"
import {
    readDebtInvoices,
    readExpiringContracts,
    readLeadActivity,
    readLeadsWithChat,
    readScanLeads,
} from "./automation-reads.query"
import type { ScanLead } from "./automation-reads.contracts"
import { instantOf, automationIsoOf } from "./policies/format.policy"
import {
    NO_SCAN,
    contractWindow,
    debtCutoffIso,
    lookbackIso,
    planContractScan,
    planDailyReport,
    planDebtScan,
    planLeadScan,
    priorRunsOf,
} from "./policies/scan.policy"
import type { ScanPlans } from "./policies/scan.policy"

const LEADS_SCANNED = 200
const NURTURE_STAGES: ReadonlyArray<string> = ["new", "qualified", "proposal"]

@Injectable()
/**
 * The scans of the templates that look at the data on a clock: which leads are quiet, which invoices are overdue, which contracts end
 * soon, whether the day report is due. A scan only decides; the engine starts what it planned.
 */
export class AutomationScansService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly runs: AutomationRunsService,
    ) {}

    /** What to start for a pipeline at this tick: runs of its own and announcements of business events; nothing for a template with no scan. */
    planScan(item: LoadedPipeline, now: Date, batch: number): Promise<ScanPlans> {
        switch (item.def.key) {
            case "daily_report": {
                const plan = planDailyReport(item.config, now)
                return Promise.resolve(plan === null ? NO_SCAN : { runs: [plan], events: [] })
            }
            case "nurture_leads":
                return this.scanLeads("nurture", item, now, batch)
            case "win_back":
                return this.scanLeads("win_back", item, now, batch)
            case "debt_reminder":
                return this.scanDebts(item, now, batch)
            case "contract_renewal":
                return this.scanContracts(item, now, batch)
            default:
                return Promise.resolve(NO_SCAN)
        }
    }

    private async scanLeads(
        kind: "nurture" | "win_back",
        item: LoadedPipeline,
        now: Date,
        batch: number,
    ): Promise<ScanPlans> {
        const workspaceId = item.pipeline.workspace_id
        const leads = await readScanLeads(this.entityManager, {
            workspaceId,
            since: lookbackIso(now, kind),
            stages: kind === "nurture" ? NURTURE_STAGES : null,
            except: kind === "win_back" ? "lost" : null,
            limit: LEADS_SCANNED,
        })
        if (leads.length === 0) return NO_SCAN
        const ids = leads.map((lead) => lead.id)
        const [activity, withChat, prior] = await Promise.all([
            this.activityOf(workspaceId, leads),
            this.chatsOf(workspaceId, ids),
            this.runs.priorRuns(item.pipeline.id, ids),
        ])
        return {
            runs: planLeadScan(
                kind,
                leads.map((lead) => ({ id: lead.id, stage: lead.stage, createdAt: automationIsoOf(lead.created_at) })),
                activity,
                withChat,
                priorRunsOf(prior),
                item.config,
                { now, batch },
            ),
            events: [],
        }
    }

    private async scanDebts(item: LoadedPipeline, now: Date, batch: number): Promise<ScanPlans> {
        const workspaceId = item.pipeline.workspace_id
        const invoices = await readDebtInvoices(this.entityManager, workspaceId, debtCutoffIso(now, item.config))
        const leadIds = invoices.flatMap((invoice) => (invoice.lead_id === null ? [] : [invoice.lead_id]))
        const [withChat, prior] = await Promise.all([
            this.chatsOf(workspaceId, leadIds),
            this.runs.priorRuns(
                item.pipeline.id,
                invoices.map((invoice) => invoice.id),
            ),
        ])
        return {
            runs: planDebtScan(
                invoices.map((invoice) => ({
                    id: invoice.id,
                    invoiceNo: invoice.invoice_no,
                    amountVnd: Number(invoice.amount_vnd),
                    leadId: invoice.lead_id,
                    dueAt: automationIsoOf(invoice.due_at ?? now),
                })),
                withChat,
                priorRunsOf(prior),
                item.config,
                now,
                batch,
            ),
            events: [],
        }
    }

    /** The contracts ending soon that this pipeline has not announced for their current end date. */
    private async scanContracts(item: LoadedPipeline, now: Date, batch: number): Promise<ScanPlans> {
        const { today, horizon } = contractWindow(now, item.config)
        const contracts = await readExpiringContracts(this.entityManager, item.pipeline.workspace_id, today, horizon)
        if (contracts.length === 0) return NO_SCAN
        const prior = await this.runs.priorRuns(
            item.pipeline.id,
            contracts.map((contract) => contract.id),
        )
        return {
            runs: [],
            events: planContractScan(
                contracts.map((contract) => ({ id: contract.id, endsOn: contract.ends_on })),
                priorRunsOf(prior).used,
                today,
                batch,
            ),
        }
    }

    /** The instant of the last activity of each lead, starting from its creation. */
    private async activityOf(
        workspaceId: string,
        leads: ReadonlyArray<ScanLead>,
    ): Promise<ReadonlyMap<string, number>> {
        const activity = new Map(leads.map((lead) => [lead.id, instantOf(lead.created_at)]))
        const rows = await readLeadActivity(
            this.entityManager,
            workspaceId,
            leads.map((lead) => lead.id),
        )
        for (const row of rows)
            activity.set(row.lead_id, Math.max(activity.get(row.lead_id) ?? 0, instantOf(row.last_at)))
        return activity
    }

    private async chatsOf(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<ReadonlySet<string>> {
        if (leadIds.length === 0) return new Set()
        const rows = await readLeadsWithChat(this.entityManager, workspaceId, leadIds)
        return new Set(rows.map((row) => row.lead_id))
    }
}
