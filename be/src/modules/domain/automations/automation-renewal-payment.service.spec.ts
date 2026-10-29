import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspacePaymentAccountService } from "@modules/domain/channel-connections"
import { InvoicesService } from "@modules/domain/invoices"
import type { InvoiceRow } from "@modules/domain/invoices"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { TextParams } from "./automations.contracts"
import { AutomationMessagesService } from "./automation-messages.service"
import { AutomationRenewalPaymentService } from "./automation-renewal-payment.service"
import { AUTOMATIONS_MESSAGES } from "./messages/automations.messages"
import type { ContractRead } from "./automation-reads.contracts"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { FakeQueryBuilder, QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"

const READS = new WeakMap<object, ReadonlyArray<FakeQueryBuilder>>()

/** The manager of {@link readingOf}. */
interface ReadingManager {
    /** The manager whose reads answer the given results. */
    readonly em: MockEntityManager
}

/** A manager whose reads (and the snapshot transaction around some of them) answer `answers`, one fake statement each, in order. */
const readingOf = (...answers: Array<QueryBuilderAnswers>): ReadingManager => {
    const em = mockEntityManager()
    fakeTransaction(em)
    READS.set(em, queueQueryBuilders(em, answers))
    return { em }
}

/** The fake statements of a manager made by {@link readingOf}, in the order the subject built them. */
const readsOf = (em: object): ReadonlyArray<FakeQueryBuilder> => READS.get(em) ?? []

const NOW = "2026-10-12T10:00:00.000Z"
const CONTRACT: ContractRead = {
    id: "c-1",
    customer_name: "Binh",
    lead_id: "l-1",
    plan: "Hosting",
    ends_on: "2026-10-20",
    amount_vnd: 1_620_000,
    status: "active",
}
const INVOICE: InvoiceRow = {
    id: "inv-1",
    workspace_id: "ws-1",
    order_id: null,
    lead_id: "l-1",
    invoice_no: "INV-202611-0003",
    amount_vnd: 1_620_000,
    status: "issued",
    issued_by: null,
    paid_at: null,
    contract_id: "c-1",
    period_ends_on: "2026-10-20",
}
const ACCOUNT = { accountNumber: "0123456789", bankCode: "VCB", holder: "TIEM HOA", provider: "sepay" }
const QR = "https://qr.sepay.vn/img?acc=0123456789&bank=VCB&amount=1620000&des=INV2026110003&template=compact"
/** The dong sign, from its code point so the source stays ASCII. */
const MONEY = `1.620.000${String.fromCodePoint(0x111)}`
const BODY = "Chao {ten_khach}, hop dong {ten_goi} het han {ngay_het_han}."
const ZALO = { id: "cv-1", channel: "zalo", handled_by: null, visitor_name: null, lead_id: "l-1" }

/** The Vietnamese text of a key as the catalog renders it. */
const vi = (key: string, params: TextParams = {}): string =>
    (AUTOMATIONS_MESSAGES.vi[`automations.${key}`] ?? key).replace(/\{\{(\w+)\}\}/g, (_whole, name: string) =>
        String(params[name] ?? ""),
    )

const PAY_LINES = [
    vi("renewal.pay.intro"),
    vi("renewal.pay.invoice", { invoice: "INV-202611-0003" }),
    vi("renewal.pay.amount", { amount: MONEY }),
    vi("renewal.pay.content", { content: "INV2026110003" }),
]

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const messages = mock<AutomationMessagesService>()
    messages.say.mockImplementation(vi)
    const invoices = mock<InvoicesService>()
    invoices.issueRenewal.mockResolvedValue({ invoice: INVOICE, created: true })
    const accounts = mock<WorkspacePaymentAccountService>()
    accounts.accountOf.mockResolvedValue(ACCOUNT)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationRenewalPaymentService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AutomationMessagesService, useValue: messages },
            { provide: InvoicesService, useValue: invoices },
            { provide: WorkspacePaymentAccountService, useValue: accounts },
        ],
    }).compile()
    return { service: moduleRef.get(AutomationRenewalPaymentService), invoices, accounts }
}

describe("AutomationRenewalPaymentService paymentOf", () => {
    it("issues the renewal invoice of the period and builds the exact payment lines with the VietQR link", async () => {
        const { service, invoices, accounts } = await build()

        const payment = await service.paymentOf("ws-1", CONTRACT, "l-1", BODY)

        expect(invoices.issueRenewal).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            contractId: "c-1",
            leadId: "l-1",
            amountVnd: 1_620_000,
            periodEndsOn: "2026-10-20",
            issuedBy: null,
        })
        expect(accounts.accountOf).toHaveBeenCalledWith("ws-1")
        expect(payment).toEqual({
            vars: { so_hoa_don: "INV-202611-0003", so_tien: MONEY, noi_dung_ck: "INV2026110003", link_qr: QR },
            fixedTail: [...PAY_LINES, vi("renewal.pay.qr", { url: QR })].join("\n"),
            keepExact: undefined,
            steps: [
                {
                    label: vi("renewal.invoiceIssued", { invoice: "INV-202611-0003" }),
                    status: "done",
                    detail: vi("renewal.invoiceDetail", { amount: MONEY, content: "INV2026110003" }),
                },
            ],
            invoiceNo: "INV-202611-0003",
            ...{ amountVnd: 1620000, transferContent: "INV2026110003" },
        })
        expect(payment?.fixedTail?.split("\n").at(-1)?.endsWith(QR)).toBe(true)
    })

    it("reuses the invoice of the period on a re-run, with the same request and the same lines", async () => {
        const { service, invoices } = await build()
        invoices.issueRenewal.mockResolvedValue({ invoice: INVOICE, created: false })

        const first = await service.paymentOf("ws-1", CONTRACT, "l-1", BODY)
        const again = await service.paymentOf("ws-1", CONTRACT, "l-1", BODY)

        expect(invoices.issueRenewal.mock.calls[0]).toEqual(invoices.issueRenewal.mock.calls[1])
        expect(again).toEqual(first)
        expect(first?.steps[0]?.label).toBe(vi("renewal.invoiceReused", { invoice: "INV-202611-0003" }))
    })

    it("leaves the QR line out and tells the owner to enter the account when the workspace has none", async () => {
        const { service, accounts } = await build()
        accounts.accountOf.mockResolvedValue(null)

        const payment = await service.paymentOf("ws-1", CONTRACT, "l-1", BODY)

        expect(payment?.fixedTail).toBe(PAY_LINES.join("\n"))
        expect(payment?.fixedTail).not.toContain("qr.sepay.vn")
        expect(payment?.vars).toMatchObject({ so_hoa_don: "INV-202611-0003", so_tien: MONEY, link_qr: "" })
        expect(payment?.steps[1]).toEqual({
            label: vi("renewal.noAccount"),
            status: "skipped",
            detail: vi("renewal.noAccountDetail"),
        })
    })

    it("adds no tail when the owner's wording places the QR link, and asks for its values to be kept exact", async () => {
        const { service, accounts } = await build()
        const placed = `${BODY} {so_hoa_don} {link_qr}`

        const withQr = await service.paymentOf("ws-1", CONTRACT, "l-1", placed)
        accounts.accountOf.mockResolvedValue(null)
        const withoutQr = await service.paymentOf("ws-1", CONTRACT, "l-1", placed)

        expect(withQr).toMatchObject({ fixedTail: undefined, keepExact: ["INV-202611-0003", "INV2026110003", QR] })
        expect(withoutQr).toMatchObject({ fixedTail: undefined, keepExact: ["INV-202611-0003", "INV2026110003"] })
    })

    it.each([[0], [null], [-1]])("issues no invoice for a contract amount of %p", async (amount) => {
        const { service, invoices, accounts } = await build()

        await expect(service.paymentOf("ws-1", { ...CONTRACT, amount_vnd: amount }, "l-1", BODY)).resolves.toBeNull()
        expect(invoices.issueRenewal).not.toHaveBeenCalled()
        expect(accounts.accountOf).not.toHaveBeenCalled()
    })
})

describe("AutomationRenewalPaymentService zaloWindowSteps", () => {
    const stepsAfter = async (lastAt: ReadonlyArray<{ created_at: string }>) => {
        const em = readingOf({ getRawOne: lastAt[0] }).em
        const { service } = await build(em)
        return { em, steps: await service.zaloWindowSteps(ZALO) }
    }

    it("warns that Zalo will not let the message out when the customer wrote more than 48 hours ago", async () => {
        const { em, steps } = await stepsAfter([{ created_at: "2026-10-10T09:59:00.000Z" }])

        expect(readsOf(em)[0]?.callsOf("where")).toEqual([
            [expect.stringContaining("m.conversation_id = :conversationId"), { conversationId: "cv-1" }],
        ])
        expect(steps).toEqual([
            { label: vi("renewal.zaloWindow"), status: "skipped", detail: vi("renewal.zaloWindowDetail") },
        ])
        expect(steps[0]?.detail).toContain("48")
        expect(steps[0]?.detail).toContain("ZNS")
    })

    it("says nothing while the window is open or when the customer never wrote", async () => {
        await expect(stepsAfter([{ created_at: "2026-10-10T10:00:00.000Z" }])).resolves.toMatchObject({ steps: [] })
        await expect(stepsAfter([])).resolves.toMatchObject({ steps: [] })
    })

    it("does not look at a conversation on another channel", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await expect(service.zaloWindowSteps({ ...ZALO, channel: "telegram" })).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
