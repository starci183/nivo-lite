import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { AutomationTemplatesService } from "@modules/domain/automation-templates"
import { AutomationTickService } from "@modules/domain/automations"
import { BankFeedService } from "@modules/domain/billing"
import { ModulesService } from "@modules/domain/modules"
import { CLOCK } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { JobRunnerService } from "@modules/platform/jobs"
import type { FencedProcessor } from "@modules/platform/jobs"
import { eachInOrder } from "@modules/platform/primitives"
import { BankFeedDeliveryProcessor } from "../../../features/jobs/bank-feed-delivery/transport/queue/bank-feed-delivery.processor"
import { ReconcileBankCreditProcessor } from "../../../features/jobs/reconcile-bank-credit/transport/queue/reconcile-bank-credit.processor"
import { WorkPerformersRegistrarService } from "../../../modules/domain/work-performers/work-performers-registrar.service"
import { persistCustomerContract, persistRenewalWorld } from "../../fixtures/builders/renewal-to-cash.builder"
import type { RenewalContract, RenewalIdentity } from "../../fixtures/builders/renewal-to-cash.builder"
import { CLEAN_USER, CLEAN_WORKSPACE } from "../../fixtures/persistence/proof.sql"
import {
    BANK_CREDIT_JOBS,
    BANK_EVENTS,
    BANK_TRANSACTIONS,
    CLEAN_FEED_RECEIPTS,
    CLEAN_JOB_KEYS,
    CONTRACT_STATE,
    EVIDENCE_OF_KIND,
    FEED_DELIVERIES,
    PIPELINE_RUNS,
    RENEWAL_INVOICES,
    WORK_ITEMS_OF_ACTION,
} from "../../fixtures/persistence/renewal-to-cash.sql"
import { API_APP_MODULES } from "../../world/api-app.options"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: API_APP_MODULES })

const identity: RenewalIdentity = {
    workspaceId: world.id(),
    ownerId: world.id(),
    accountingAgentId: world.id(),
    careAgentId: world.id(),
    connectionId: world.id(),
    leadId: world.id(),
    conversationId: world.id(),
    contractId: world.id(),
    pipelineId: world.id(),
}
const WS = identity.workspaceId
const SECOND_CONTRACT = world.id()
const ACCOUNT = { accountNumber: "0123456789", bankCode: "MB", holder: "CONG TY NIVO PROOF" }
/** The renewal amounts, with the digits the Vietnamese money format writes them in. */
const FIRST_AMOUNT = { vnd: 1_500_000, digits: "1.500.000" }
const SECOND_AMOUNT = 2_000_000
/** The arrow the renewal evidence writes between the old and the new last day of the contract. */
const ARROW = "\u2192"

const DAY_MS = 86_400_000
const VN_OFFSET_MS = 7 * 3_600_000
const plusDays = (iso: string, days: number): string =>
    new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
/** The same day `years` years later or earlier (the scenario days are never 29 February). */
const plusYears = (iso: string, years: number): string => `${Number(iso.slice(0, 4)) + years}${iso.slice(4)}`
const display = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

/** One invoice as the database holds it. */
interface InvoiceState {
    readonly id: string
    readonly invoice_no: string
    readonly amount_vnd: number
    readonly status: string
    readonly lead_id: string | null
    readonly contract_id: string | null
    readonly period_ends_on: string | null
    readonly paid_at: string | null
}

/** One invoice a proposal offers. */
interface ProposalCandidateState {
    readonly id: string
}

/** The part of a work item's proposal the proof reads. */
interface ProposalState {
    readonly draft?: string
    readonly candidates?: ReadonlyArray<ProposalCandidateState>
}

/** One work item as the database holds it. */
interface WorkItemState {
    readonly id: string
    readonly status: string
    readonly decided_path: string | null
    readonly reason: string | null
    readonly inbound_event_id: string | null
    readonly lead_id: string | null
    readonly proposal: ProposalState
}

/** One bank credit as an inbound event. */
interface BankEventState {
    readonly id: string
    readonly status: string
    readonly amount_vnd: number
    readonly external_ref: string | null
    readonly event_id: string | null
}

/** One bank transaction. */
interface TransactionState {
    readonly id: string
    readonly status: string
    readonly invoice_id: string | null
    readonly amount_vnd: number
}

/** One contract as it stands. */
interface ContractState {
    readonly starts_on: string
    readonly ends_on: string
    readonly note: string
    readonly status: string
}

/** One step of an automation run. */
interface RunStepState {
    readonly label: string
}

/** One automation run. */
interface RunState {
    readonly status: string
    readonly steps: ReadonlyArray<RunStepState>
}

/** One evidence line. */
interface EvidenceState {
    readonly summary: string
    readonly evidence: string | null
}

/** One queued job as the outbox holds it. */
interface OutboxJob {
    readonly id: string
    readonly queue: string
    readonly name: string
    readonly payload: object
}

/** The two contracts of the story, dated from the world's clock once it is open. */
interface StoryContracts {
    first: RenewalContract
    second: RenewalContract
}

/** What the suite learns along the loop. */
interface LoopState {
    today: string
    invoiceNo: string
    invoiceId: string
    transfer: string
}

const story: StoryContracts = {
    first: { startsOn: "", endsOn: "", amountVnd: FIRST_AMOUNT.vnd, plan: "Spa Gold" },
    second: { startsOn: "", endsOn: "", amountVnd: SECOND_AMOUNT, plan: "Spa Silver" },
}
const loop: LoopState = { today: "", invoiceNo: "", invoiceId: "", transfer: "" }

const db = () => world.db.primary
const say = (key: string, params: Record<string, string | number> = {}): string =>
    world.resolve<MessageCatalog>(MESSAGE_CATALOG).get(key, params, "vi")

const invoicesOf = (contractId: string) => db().query<Array<InvoiceState>>(RENEWAL_INVOICES, [WS, contractId])
const workOf = (action: string) => db().query<Array<WorkItemState>>(WORK_ITEMS_OF_ACTION, [WS, action])
const creditsOf = () => db().query<Array<BankEventState>>(BANK_EVENTS, [WS])
const renewalsLogged = () => db().query<Array<EvidenceState>>(EVIDENCE_OF_KIND, [WS, "contract.renewed"])
const feedReceipts = () => db().query<Array<OutboxJob>>(FEED_DELIVERIES, [identity.connectionId])
const creditJobs = () => db().query<Array<OutboxJob>>(BANK_CREDIT_JOBS, [WS])
const contractOf = async (contractId: string): Promise<ContractState> => {
    const [row] = await db().query<Array<ContractState>>(CONTRACT_STATE, [WS, contractId])
    if (row === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { contractId } })
    return row
}

/** A yearly contract ending `days` days after today (never on 29 February). */
const yearlyEnding = (days: number, contract: RenewalContract): RenewalContract => {
    const day = plusDays(loop.today, days)
    const endsOn = day.endsWith("-02-29") ? plusDays(day, 1) : day
    return { ...contract, startsOn: plusYears(endsOn, -1), endsOn }
}

/** The automation queue's business event, as the contract scan announces a contract entering its renewal window. */
const announceExpiring = (contractId: string, contract: RenewalContract): Promise<void> =>
    world.resolve(AutomationTickService).run({
        kind: "business_event",
        event: "contract.expiring",
        workspaceId: WS,
        dedupe: `contract.expiring:${contractId}:${contract.endsOn}`,
        data: {
            contract_id: contractId,
            ends_on: contract.endsOn,
            days_left: Math.round((Date.parse(contract.endsOn) - Date.parse(loop.today)) / DAY_MS),
        },
    })

/** The SePay webhook body of one incoming transfer into the workspace's account. */
const sepayBody = (id: number, amount: number, content: string): Buffer =>
    Buffer.from(
        JSON.stringify({
            id,
            gateway: "MBBank",
            transactionDate: "2026-10-28 09:15:00",
            accountNumber: ACCOUNT.accountNumber,
            code: null,
            content,
            transferType: "in",
            transferAmount: amount,
            accumulated: 9_000_000,
            subAccount: null,
            referenceCode: `FT${id}`,
            description: `BankAPINotify ${content}`,
        }),
    )

/** The outbox rows the scenario already handed to a processor; each runs once, as the relay delivers it once. */
const delivered = new Set<string>()

/** Hands every new outbox row of a queue to its real processor through the composed fenced job runner. */
const runQueued = async (queued: ReadonlyArray<OutboxJob>, processor: FencedProcessor): Promise<void> => {
    const fresh = queued.filter((job) => !delivered.has(job.id))
    await eachInOrder(fresh, async (job) => {
        delivered.add(job.id)
        await world.resolve(JobRunnerService).run(processor, {
            id: job.id,
            queue: job.queue,
            job: job.name,
            payload: job.payload,
            attempt: 1,
            signal: new AbortController().signal,
        })
    })
}

/**
 * The SePay webhook path after its credential proof: the receipt is recorded with its queue message, the bank-feed-delivery job
 * books it (one inbound payment event and its reconcile job), and the reconcile-bank-credit job settles it.
 */
const deliverSepay = async (id: number, amount: number, content: string): Promise<void> => {
    await world.resolve(BankFeedService).acceptSepayFeedDelivery(sepayBody(id, amount, content), identity.connectionId)
    await runQueued(await feedReceipts(), world.resolve(BankFeedDeliveryProcessor))
    await runQueued(await creditJobs(), world.resolve(ReconcileBankCreditProcessor))
}

beforeAll(async () => {
    world.cleanup(async () => {
        await db().query(CLEAN_JOB_KEYS, [[...delivered]])
        await db().query(CLEAN_FEED_RECEIPTS, [identity.connectionId])
        await db().query(CLEAN_WORKSPACE, [WS])
        await db().query(CLEAN_USER, [identity.ownerId])
    })
    loop.today = new Date(world.resolve<Clock>(CLOCK).now().getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)
    story.first = yearlyEnding(7, story.first)
    story.second = yearlyEnding(10, story.second)
    // The world compiles the api without booting it: the performers join the work engine as they do at boot.
    world.resolve(WorkPerformersRegistrarService).onModuleInit()
    await world.resolve(ModulesService).sync()
    await world.resolve(AutomationTemplatesService).syncFromCatalog()
    await persistRenewalWorld(db(), { identity, account: ACCOUNT, contract: story.first })
    const rules = world.resolve(AuthorityRulesService)
    await rules.save(WS, {
        action: "reconcile_payment",
        department: "accounting",
        mode: "auto",
        limit_vnd: 50_000_000,
        required_fields: ["amount_vnd"],
        note: null,
    })
    await rules.save(WS, {
        action: "send_follow_up",
        department: "sales",
        mode: "ask",
        limit_vnd: null,
        required_fields: ["contact"],
        note: null,
    })
})

describe("renewal-to-cash: the contract_renewal automation bills the period and drafts the message", () => {
    it("issues the renewal invoice of the period and drafts the message with the exact payment tail", async () => {
        await announceExpiring(identity.contractId, story.first)

        const invoices = await invoicesOf(identity.contractId)
        expect(invoices).toHaveLength(1)
        const [invoice] = invoices
        expect(invoice).toMatchObject({
            status: "issued",
            amount_vnd: FIRST_AMOUNT.vnd,
            lead_id: identity.leadId,
            contract_id: identity.contractId,
            period_ends_on: story.first.endsOn,
            paid_at: null,
        })
        expect(invoice?.invoice_no).toMatch(/^INV-\d{6}-\d{4}$/u)
        loop.invoiceNo = invoice?.invoice_no ?? ""
        loop.invoiceId = invoice?.id ?? ""
        loop.transfer = loop.invoiceNo.replaceAll("-", "")

        const qr =
            `https://qr.sepay.vn/img?acc=${ACCOUNT.accountNumber}&bank=${ACCOUNT.bankCode}` +
            `&amount=${FIRST_AMOUNT.vnd}&des=${loop.transfer}&template=compact`
        const tail = [
            say("automations.renewal.pay.intro"),
            say("automations.renewal.pay.invoice", { invoice: loop.invoiceNo }),
            say("automations.renewal.pay.amount", {
                amount: say("automations.renewal.money", { amount: FIRST_AMOUNT.digits }),
            }),
            say("automations.renewal.pay.content", { content: loop.transfer }),
            say("automations.renewal.pay.qr", { url: qr }),
        ].join("\n")
        const drafts = await workOf("send_follow_up")
        expect(drafts).toHaveLength(1)
        expect(drafts[0]).toMatchObject({ status: "waiting_decision", lead_id: identity.leadId })
        expect(drafts[0]?.proposal.draft?.endsWith(`\n\n${tail}`)).toBe(true)

        const runs = await db().query<Array<RunState>>(PIPELINE_RUNS, [identity.pipelineId])
        expect(runs).toHaveLength(1)
        expect(runs[0]?.status).toBe("waiting_approval")
        expect(runs[0]?.steps.map((step) => step.label)).toContain(
            say("automations.renewal.invoiceIssued", { invoice: loop.invoiceNo }),
        )
    })
})

describe("renewal-to-cash: the SePay credit settles the invoice and renews the contract", () => {
    it("matches the credit by itself: the invoice is paid, reconcile_payment is done by policy, the contract runs one more term", async () => {
        await deliverSepay(910_001, FIRST_AMOUNT.vnd, `CHI THAO CK ${loop.transfer}`)

        const [invoice] = await invoicesOf(identity.contractId)
        expect(invoice).toMatchObject({ id: loop.invoiceId, status: "paid" })
        expect(invoice?.paid_at).not.toBeNull()

        const reconciled = await workOf("reconcile_payment")
        expect(reconciled).toHaveLength(1)
        expect(reconciled[0]).toMatchObject({ status: "done", decided_path: "auto", reason: "routine" })
        expect(reconciled[0]?.proposal.candidates?.map((candidate) => candidate.id)).toEqual([loop.invoiceId])

        const credits = await creditsOf()
        expect(credits).toHaveLength(1)
        expect(credits[0]).toMatchObject({ amount_vnd: FIRST_AMOUNT.vnd, event_id: "sepay:910001" })
        expect(reconciled[0]?.inbound_event_id).toBe(credits[0]?.id)
        await expect(db().query<Array<TransactionState>>(BANK_TRANSACTIONS, [WS])).resolves.toEqual([
            expect.objectContaining({ status: "matched", invoice_id: loop.invoiceId, amount_vnd: FIRST_AMOUNT.vnd }),
        ])

        const renewedUntil = plusYears(story.first.endsOn, 1)
        const contract = await contractOf(identity.contractId)
        expect(contract).toMatchObject({ status: "active", starts_on: story.first.endsOn, ends_on: renewedUntil })
        expect(contract.note.split("\n")).toContain(
            say("contracts.renewalNote", { until: display(renewedUntil), no: loop.invoiceNo }),
        )
        await expect(renewalsLogged()).resolves.toEqual([
            expect.objectContaining({ evidence: `${story.first.endsOn} ${ARROW} ${renewedUntil}` }),
        ])
    })

    it("changes nothing when SePay delivers the same transfer again", async () => {
        const before = {
            contract: await contractOf(identity.contractId),
            invoices: await invoicesOf(identity.contractId),
            credits: await creditsOf(),
            reconciled: await workOf("reconcile_payment"),
            receipts: await feedReceipts(),
            jobs: await creditJobs(),
            renewals: await renewalsLogged(),
        }

        await deliverSepay(910_001, FIRST_AMOUNT.vnd, `CHI THAO CK ${loop.transfer}`)

        await expect(contractOf(identity.contractId)).resolves.toEqual(before.contract)
        await expect(invoicesOf(identity.contractId)).resolves.toEqual(before.invoices)
        await expect(creditsOf()).resolves.toEqual(before.credits)
        await expect(workOf("reconcile_payment")).resolves.toEqual(before.reconciled)
        await expect(feedReceipts()).resolves.toEqual(before.receipts)
        await expect(creditJobs()).resolves.toEqual(before.jobs)
        await expect(renewalsLogged()).resolves.toEqual(before.renewals)
    })
})

describe("renewal-to-cash: a credit of the wrong amount waits for the owner", () => {
    it("holds a second credit naming an issued renewal invoice with another amount as needs_decision", async () => {
        await persistCustomerContract(db(), {
            workspaceId: WS,
            contractId: SECOND_CONTRACT,
            leadId: identity.leadId,
            contract: story.second,
        })
        await announceExpiring(SECOND_CONTRACT, story.second)
        const [second] = await invoicesOf(SECOND_CONTRACT)
        expect(second).toMatchObject({
            status: "issued",
            amount_vnd: SECOND_AMOUNT,
            period_ends_on: story.second.endsOn,
        })
        const transfer = (second?.invoice_no ?? "").replaceAll("-", "")

        await deliverSepay(910_002, SECOND_AMOUNT - 1_000, `CHI THAO CK ${transfer}`)

        const credits = await creditsOf()
        expect(credits).toHaveLength(2)
        expect(credits[1]).toMatchObject({
            status: "needs_decision",
            amount_vnd: SECOND_AMOUNT - 1_000,
            event_id: "sepay:910002",
        })
        await expect(invoicesOf(SECOND_CONTRACT)).resolves.toEqual([
            expect.objectContaining({ id: second?.id, status: "issued", paid_at: null }),
        ])
        await expect(workOf("reconcile_payment")).resolves.toHaveLength(1)
        await expect(contractOf(SECOND_CONTRACT)).resolves.toMatchObject({ ends_on: story.second.endsOn, note: "" })
    })
})
