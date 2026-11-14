import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    callWorkflow,
    defineTemplateGraph,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { idSchema } from "../../../nodes/webbooks/books-shapes"
import { webbooksPaymentCreditNode } from "../../../nodes/webbooks/payment-credit.node"
import { webbooksPaymentOpenNode } from "../../../nodes/webbooks/payment-open.node"
import { webbooksPaymentSettleNode } from "../../../nodes/webbooks/payment-settle.node"
import { webbooksPurchasePaidTeamNode } from "../../../nodes/webbooks/purchase-paid-team.node"
import { webbooksPurchasePaidNode } from "../../../nodes/webbooks/purchase-paid.node"
import { webbooksRenewalPaidTeamNode } from "../../../nodes/webbooks/renewal-paid-team.node"
import { webbooksRenewalPaidNode } from "../../../nodes/webbooks/renewal-paid.node"

/** The language the team reads (today's templates fix it). */
const LOCALE = "vi"

/** The graph's contract: the bank row the credit names, in the event's data (the one pipeline's trigger scope). */
const input = z.object({ data: z.object({ transactionId: idSchema }) })

/**
 * `webbooks.payment` version 12 (Reconcile money in), woken by a bank credit alone (SePay or Casso; the verb is a CREDIT, so
 * today's `direction == in` condition is the verb itself). It is composed of generic pieces: `credit` reads the raw bank row the trigger
 * names (the provider's generic read of received credits), `open` reads the CRM's requests awaiting money, `match` settles the credit
 * against ONE open request (exact comparisons first, by the pure rule `rules/webbooks/payment-match`: a payment code held in the transfer
 * text and an amount equal to the total, no model; the agent only for what they leave open; unclear money fails confused and the
 * founder decides) and routes: a renewal is
 * recorded paid, the team told, and handed to the provider renewal (Renewal agent); a purchase is recorded paid, the team told,
 * and handed to Sales. Each hand-off runs before its outcome (the contract's `outcome` has no `next`). The request's id is present
 * on its own route (`match`'s output says so); the record steps take null and refuse it exactly. A person who declines a record
 * (money) made a decision: it is the record step's unsuccessful ending (R68): the ENGINE tells the team (the step, `declined`, the
 * service or purchase code) and the run ends `declined`; no team line, no hand-off. Change from version 11 (R68): the hand-drawn
 * `record-declined`/`record-notice` and `purchase-declined`/`purchase-notice` pairs are the record steps' `unsuccessful` option.
 * Change from version 9: `record-team` / `purchase-team` answer `declined: true` when a person declined their team line on its card;
 * they are side steps (`blocking: false`, a failure of theirs was always passed over), so a declined team line skips that line only and
 * the hand-off runs as before: the money is recorded, the renewal or the sale must go on.
 */
export const paymentGraph: TemplateGraph = defineTemplateGraph({
    key: "webbooks.payment",
    title: { vi: "\u0110\u1ed1i so\u00e1t ti\u1ec1n v\u1ec1", en: "Reconcile money in" },
    input,
    // One source per STREAM (owner 2026-11-12): both feeds listen; different bank accounts both fire, one bank account behind both waits
    // for the founder's pick (the engine never picks).
    triggers: [trigger(TRIGGER.paymentCreditReceived, { accounts: [PROVIDER.sepay, PROVIDER.casso] })],
    openTo: "any",
    start: "credit",
    catalogue: {
        name: { vi: "\u0110\u1ed1i so\u00e1t ti\u1ec1n v\u1ec1", en: "Reconcile money in" },
        summary: {
            vi: "Khi ng\u00e2n h\u00e0ng b\u00e1o c\u00f3 ti\u1ec1n v\u00e0o: kh\u1edbp v\u1edbi y\u00eau c\u1ea7u gia h\u1ea1n ho\u1eb7c \u0111\u01a1n mua \u0111ang ch\u1edd tr\u1ea3 b\u1eb1ng m\u00e3 thanh to\u00e1n v\u00e0 \u0111\u00fang s\u1ed1 ti\u1ec1n, ghi nh\u1eadn \u0111\u00e3 tr\u1ea3 trong CRM, b\u00e1o \u0111\u1ed9i, r\u1ed3i chuy\u1ec3n sang gia h\u1ea1n t\u1ea1i nh\u00e0 cung c\u1ea5p ho\u1eb7c cho Kinh doanh",
            en: "When the bank reports money in: matches it to the renewal request or the purchase awaiting payment by its payment code and exact amount, records it paid in the CRM, tells the team, then hands on to the provider renewal or to Sales",
        },
        version: 12,
        publishedAt: "2026-11-14T22:00:00.000Z",
        notes: {
            vi: "R68: ghi nhận tiền bị từ chối duyệt thì hệ thống tự báo đội kèm mã dịch vụ hoặc mã đơn mua và kết thúc bị từ chối; quy trình chỉ còn các bước nghiệp vụ",
            en: "R68: a record of money a person declined is told to the team by the engine with the service or purchase code and the run ends declined; the workflow keeps only its business steps",
        },
    },
    nodes: {
        credit: node(webbooksPaymentCreditNode, {
            input: { transactionId: ref("trigger.data.transactionId") },
            next: "open",
        }),
        open: node(webbooksPaymentOpenNode, { input: {}, next: "match" }),
        match: node(webbooksPaymentSettleNode, {
            input: {
                transactionRef: ref("steps.credit.output.transactionRef"),
                amountVnd: ref("steps.credit.output.amountVnd"),
                reference: ref("steps.credit.output.reference", { default: null }),
                renewals: ref("steps.open.output.renewals"),
                purchases: ref("steps.open.output.purchases"),
                locale: LOCALE,
            },
            routes: { renewal: "record", purchase: "purchase" },
        }),

        // A renewal request paid.
        record: node(webbooksRenewalPaidNode, {
            input: {
                renewalId: ref("steps.match.output.renewalId", { default: null }),
                transactionRef: ref("steps.match.output.transactionRef"),
            },
            next: "record-team",
            unsuccessful: {
                then: "end",
                outcome: "declined",
                facts: [{ label: { vi: "Mã dịch vụ", en: "Service" }, value: ref("steps.match.output.serviceCode", { default: null }) }],
            },
        }),
        "record-team": node(webbooksRenewalPaidTeamNode, {
            input: {
                customerCode: ref("steps.match.output.customerCode"),
                serviceCode: ref("steps.match.output.serviceCode", { default: null }),
                transactionRef: ref("steps.match.output.transactionRef"),
                state: ref("steps.record.output.state", { default: null }),
                reason: ref("steps.match.output.reason"),
                locale: LOCALE,
            },
            // A side line: declined or not, the hand-off runs (the money is recorded).
            next: "to-renew",
        }),
        "to-renew": callWorkflow({
            agent: "webrenew",
            workflow: "renew",
            version: "latest",
            input: {
                renewalId: ref("steps.record.output.renewalId"),
                customerCode: ref("steps.match.output.customerCode"),
                serviceCode: ref("steps.match.output.serviceCode"),
                termMonths: ref("steps.match.output.termMonths"),
                transactionRef: ref("steps.match.output.transactionRef"),
            },
            next: "paid",
        }),
        paid: outcome({
            name: "paid",
            label: { vi: "Đã ghi nhận gia hạn đã trả", en: "Renewal paid" },
            output: {
                renewalId: ref("steps.record.output.renewalId"),
                customerCode: ref("steps.match.output.customerCode"),
                serviceCode: ref("steps.match.output.serviceCode"),
                termMonths: ref("steps.match.output.termMonths"),
                transactionRef: ref("steps.match.output.transactionRef"),
            },
        }),

        // A purchase awaiting payment paid.
        purchase: node(webbooksPurchasePaidNode, {
            input: {
                purchaseId: ref("steps.match.output.purchaseId", { default: null }),
                transactionRef: ref("steps.match.output.transactionRef"),
            },
            next: "purchase-team",
            unsuccessful: {
                then: "end",
                outcome: "declined",
                facts: [{ label: { vi: "Mã đơn mua", en: "Purchase" }, value: ref("steps.match.output.purchaseCode", { default: null }) }],
            },
        }),
        "purchase-team": node(webbooksPurchasePaidTeamNode, {
            input: {
                customerCode: ref("steps.match.output.customerCode"),
                code: ref("steps.purchase.output.code", { default: null }),
                transactionRef: ref("steps.match.output.transactionRef"),
                state: ref("steps.purchase.output.state", { default: null }),
                reason: ref("steps.match.output.reason"),
                locale: LOCALE,
            },
            // A side line: declined or not, the hand-off runs (the money is recorded).
            next: "to-sales",
        }),
        "to-sales": callWorkflow({
            agent: "websales",
            workflow: "won",
            version: "latest",
            input: {
                purchaseId: ref("steps.purchase.output.purchaseId"),
                customerCode: ref("steps.match.output.customerCode"),
                transactionRef: ref("steps.match.output.transactionRef"),
            },
            next: "purchase-paid",
        }),
        "purchase-paid": outcome({
            name: "purchase-paid",
            label: { vi: "Đã ghi nhận đơn mua đã trả", en: "Purchase paid" },
            output: {
                purchaseId: ref("steps.purchase.output.purchaseId"),
                customerCode: ref("steps.match.output.customerCode"),
                transactionRef: ref("steps.match.output.transactionRef"),
            },
        }),

        // A person declined a record of money: the engine told the team; nothing else runs. Reached only by the record steps'
        // unsuccessful ending (no edge of the graph), it reads no step: no output (R68; v11 output `match`'s transactionRef).
        declined: outcome({ name: "declined", label: { vi: "Bị từ chối", en: "Declined" } }),
    },
})
