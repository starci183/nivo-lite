import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    and,
    defineTemplateGraph,
    endRound,
    equals,
    handBack,
    ifNode,
    loop,
    node,
    or,
    outcome,
    present,
    ref,
    round,
    trigger,
    wait,
    waitFor,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { websalesAskNode } from "../../../nodes/websales/ask.node"
import { websalesHeardNotifyNode } from "../../../nodes/websales/heard-notify.node"
import { websalesHeardReplyNode } from "../../../nodes/websales/heard-reply.node"
import { websalesLostNotifyNode } from "../../../nodes/websales/lost-notify.node"
import { websalesPurchaseLoseNode } from "../../../nodes/websales/purchase-lose.node"
import { websalesPurchaseNoteNode } from "../../../nodes/websales/purchase-note.node"
import { websalesPurchaseOpenNode } from "../../../nodes/websales/purchase-open.node"
import { websalesQuoteCreateNode } from "../../../nodes/websales/quote-create.node"
import { websalesQuoteSendNode } from "../../../nodes/websales/quote-send.node"
import { websalesRoundMessageNode } from "../../../nodes/websales/round-message.node"
import { websalesUnderstandNode } from "../../../nodes/websales/understand.node"
import { webdeskUnderstandSalesNode } from "../../../nodes/webdesk/understand-sales.node"
import { DECLINED_END, declinedEnd, endsDeclined, goesOn, purchaseFact } from "./declined"

/** The language the team reads (version 1's constant param). */
const LOCALE = "vi"

/** The graph's contract: what the Support front door supplies through its workflow call; as version 1. */
const enquiryInput = z.object({
    text: z.string().min(1).max(8000),
    conversationId: z.string().min(1).max(120),
    channel: z.string().min(1).max(40),
    contactId: z.string().min(1).max(120).nullish(),
    summary: z.string().max(8000).nullish(),
})

/** The rounds of the talk: one per message of the person (R9: a body that parks at a wait may run 30). */
const TALK_ROUNDS = 30

/** The words THIS round answers (`message`: the hand-off's in round 1, the ones the round's wait took later). */
const ROUND_TEXT = ref("steps.message.output.text")

/** The front door's one line about them (the hand-off's summary in round 1, the round's own `desk` later): v7's `trigger.data.summary`. */
const ROUND_SUMMARY = ref("steps.message.output.summary")

/** The purchase the open step answered, as every later step of the round takes it. */
const PURCHASE = {
    purchaseId: ref("steps.open.output.purchaseId"),
    purchaseCode: ref("steps.open.output.purchaseCode"),
}

/** A member of the understand step that ended the talk: the loop's `last` (R46: the last NODE step of the final round). */
const ended = (member: string) => ref(`steps.talk.output.last.${member}`, { default: null })

/** The purchase the ending round's understand step answered, as the steps after the talk take it. */
const ENDED_PURCHASE = { purchaseId: ended("purchaseId"), purchaseCode: ended("purchaseCode") }

/** What the heard reply takes, for one ending route (agreed, paid): the ending round's message and purchase (v7's `heardInput`). */
const heardInput = (heard: "agreed" | "paid") => ({
    heard,
    text: ended("text"),
    ...ENDED_PURCHASE,
    conversationId: ref("trigger.data.conversationId"),
    locale: LOCALE,
})

/** What the heard notice takes, for one ending route (v7's `heardNotifyInput`). */
const heardNotifyInput = (heard: "agreed" | "paid") => ({
    heard,
    text: ended("text"),
    summary: ended("summary"),
    purchaseCode: ended("purchaseCode"),
    locale: LOCALE,
})

/** A blocking step of a round that a person declined (its `declined` member): the talk stops, as the run stopped in v7. */
const declinedIn = (step: string) => equals(ref(`steps.${step}.output.declined`, { default: false }), true)

/** The understand step's route in the round that just ended. */
const routed = (branch: string) => equals(ref("steps.understand.output.branch", { default: null }), branch)

/** What the template catalogue shows of `websales.enquiry` version 9. */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "Tư vấn khách mới", en: "Advise a new customer" },
    summary: {
        vi: "Khách hỏi mua dịch vụ mới (Hỗ trợ chuyển sang): ghi nhận yêu cầu trong CRM, hỏi nhu cầu hoặc báo giá từ bảng giá; khách đồng ý hay báo đã chuyển khoản thì nhắn khách, báo đội rồi dừng để người trong đội làm tiếp",
        en: "A customer asks to buy something new (handed on by Support): records the enquiry in the CRM, asks the need or quotes from the price list; on a yes or a 'money sent' it tells the customer and the team and stops for a person to take over",
    },
    version: 9,
    // The old JSON template had `seedActive: true`: the seed makes an ACTIVE workflow from it.
    seedActive: true,
    publishedAt: "2026-11-14T22:00:00.000Z",
    notes: {
        vi: "R68: bước bị từ chối duyệt (hay lời gửi khách bị chặn) thì hệ thống tự báo đội kèm mã đơn mua; trong cuộc trò chuyện thì cuộc trò chuyện dừng, sau cuộc trò chuyện thì dừng ở kết quả Bị từ chối",
        en: "R68: a declined step (or a refused customer send) is told to the team by the engine with the purchase code; inside the talk the talk ends, after it the run ends declined",
    },
}

/**
 * `websales.enquiry` version 8 (Tu van khach moi): THE CONVERSATION AS ONE RUN (owner's rule, R53; the form of `sales.consult`). The
 * business of version 7 is kept step for step; only the form moved (WEBCORE-AUDIT.md, websales BEFORE / AFTER):
 * - TALK LOOP (`talk`, at most 30 rounds). Round 1 answers the front door's hand-off (its words, its summary). Every later round parks at
 *   `hear` for the person's next Zalo message (a day at most) and first runs the FRONT DOOR'S OWN judgement (`desk`,
 *   `webdesk.understand`, the step that decided whether a run of v7 started): `sales` goes on; anything else is handed back
 *   (`give-back`) to the graphs registered on the message (the front door), where v7 would have sent it. `message` takes the round's
 *   words and the front door's line about them.
 * - Each round runs v7's steps on its message: `open` (the purchase of the conversation), `note` (side), `understand`, routing five
 *   ways: ask -> `ask`; quote -> `quote` -> `quote-send`: the round ends and the talk waits for the person. agree with no quote held
 *   (`has-quote`, the open step's own answer) -> `ask`. agree with a quote held, paid, no: the round ends and so does the talk.
 * - AFTER THE TALK (`settled`), read from the understand step that ended it (`last`): agree -> `agreed-reply` -> `agreed-notify`
 *   (side) -> `agreed`; paid -> `paid-reply` -> `paid-notify` (side), the run ends; no -> `lose` -> `lost-notify` (side) -> `lost`.
 * - Declined (a person declined a write or send set to `ask`, a decision) or unsuccessful (a customer send refused, a step's
 *   `cannot`): each blocking step declares its `unsuccessful` ending (R68): the ENGINE tells the team (the step, the reason, the
 *   purchase code) and the step takes its own exit inside the talk (`opened` / `quoted` let only a real purchase / quote go on; a
 *   declined step ends the round, the talk's `until` ends the talk, `declined-said` ends the run `declined`), or the run ends `declined`
 *   after the talk. Change from version 8: the `<step>-declined` checks and their notices are gone (the engine reports).
 * - The person going quiet (a day without a message) or 30 rounds end the talk `quiet`, with no notice: a later message starts at the
 *   front door again, as every message did in v7. Hidden without the CRM or without any messaging account.
 */
export const enquiryGraph: TemplateGraph = defineTemplateGraph({
    key: "websales.enquiry",
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({ data: enquiryInput }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "talk",
    nodes: {
        talk: loop({
            label: { vi: "Trò chuyện với khách", en: "Talk with the customer" },
            exits: {
                until: { vi: "Thoát khi khách chốt, đã trả, không mua, bị từ chối hoặc im lặng", en: "Out when the customer agrees, paid, says no, a step is declined or they go quiet" },
                exhausted: { vi: "Hết 30 lượt tin nhắn", en: "30 messages used up" },
            },
            until: or(
                declinedIn("open"),
                declinedIn("ask"),
                declinedIn("quote"),
                declinedIn("quote-send"),
                routed("paid"),
                routed("no"),
                and(routed("agree"), equals(ref("steps.open.output.quoted", { default: false }), true)),
                equals(ref("steps.hear.output.trigger", { default: null }), "timeout"),
            ),
            max: TALK_ROUNDS,
            body: {
                start: "opening",
                nodes: {
                    // Round 1 has no event: its message is the hand-off's. Every later round takes the person's next message first.
                    opening: ifNode({ label: { vi: "Lượt đầu tiên?", en: "First round?" }, when: equals(round(), 1), yes: "message", no: "hear" }),
                    hear: wait({
                        label: { vi: "Chờ tin tiếp theo của khách (tối đa 1 ngày)", en: "Wait for the customer's next message (a day at most)" },
                        for: { zalo: waitFor(TRIGGER.zaloMessageReceived) },
                        timeout: "1d",
                        next: { zalo: "desk", timeout: endRound },
                    }),
                    // The front door's own judgement of the message (what started a run of v7): not a new purchase -> back to it.
                    desk: node(webdeskUnderstandSalesNode, {
                        input: { text: ref("steps.hear.output.event.data.text") },
                        routes: {
                            sales: "message",
                            fault: "give-back",
                            renewal: "give-back",
                            complaint: "give-back",
                            question: "give-back",
                        },
                    }),
                    "give-back": handBack({ label: { vi: "Trả tin về Lễ tân", en: "Hand the message back to the front desk" }, wait: "hear" }),
                    message: node(websalesRoundMessageNode, {
                        input: {
                            handed: ref("trigger.data.text"),
                            handedSummary: ref("trigger.data.summary", { default: null }),
                            latest: ref("steps.hear.output.event.data.text", { default: null }),
                            latestSummary: ref("steps.desk.output.summary", { default: null }),
                        },
                        next: "open",
                    }),
                    open: node(websalesPurchaseOpenNode, {
                        input: {
                            text: ROUND_TEXT,
                            conversationId: ref("trigger.data.conversationId"),
                            channel: ref("trigger.data.channel"),
                            contactId: ref("trigger.data.contactId"),
                            summary: ROUND_SUMMARY,
                            locale: LOCALE,
                        },
                        next: "opened",
                        // No purchase was opened: the notice names no record.
                        unsuccessful: goesOn([]),
                    }),
                    // Only a purchase really opened goes on; a declined (or failed) opening ends the round (the talk's `until` ends the talk).
                    opened: ifNode({
                        label: { vi: "Đã ghi nhận yêu cầu mua?", en: "Enquiry recorded?" },
                        when: equals(ref("steps.open.output.declined"), false),
                        yes: "note",
                        no: endRound,
                    }),
                    note: node(websalesPurchaseNoteNode, {
                        input: { ...PURCHASE, held: ref("steps.open.output.held"), text: ROUND_TEXT, locale: LOCALE },
                        next: "understand",
                    }),
                    understand: node(websalesUnderstandNode, {
                        input: { ...PURCHASE, text: ROUND_TEXT, quoted: ref("steps.open.output.quoted"), summary: ROUND_SUMMARY, locale: LOCALE },
                        routes: { ask: "ask", quote: "quote", agree: "has-quote", paid: endRound, no: endRound },
                    }),
                    ask: node(websalesAskNode, {
                        input: {
                            text: ROUND_TEXT,
                            summary: ref("steps.understand.output.summary"),
                            ...PURCHASE,
                            conversationId: ref("trigger.data.conversationId"),
                            locale: LOCALE,
                        },
                        // Asked or declined, the round ends here (no `next`).
                        unsuccessful: goesOn([purchaseFact(ref("steps.open.output.purchaseCode"))]),
                    }),
                    quote: node(websalesQuoteCreateNode, {
                        input: { ...PURCHASE, items: ref("steps.understand.output.items") },
                        next: "quoted",
                        unsuccessful: goesOn([purchaseFact(ref("steps.open.output.purchaseCode"))]),
                    }),
                    // Only a quote the CRM really made is sent; a declined (or failed) quote ends the round.
                    quoted: ifNode({
                        label: { vi: "Đã lập báo giá?", en: "Quote made?" },
                        when: equals(ref("steps.quote.output.declined"), false),
                        yes: "quote-send",
                        no: endRound,
                    }),
                    "quote-send": node(websalesQuoteSendNode, {
                        input: {
                            ...PURCHASE,
                            // Null only when the quote was declined, an ending that never reaches this step.
                            quote: ref("steps.quote.output.quote", { default: null }),
                            summary: ref("steps.understand.output.summary"),
                            conversationId: ref("trigger.data.conversationId"),
                            locale: LOCALE,
                        },
                        // Sent or declined, the round ends here (no `next`).
                        unsuccessful: goesOn([purchaseFact(ref("steps.open.output.purchaseCode"))]),
                    }),
                    // v7's `has-quote`: a yes with no quote held asks the need; a yes to a held quote ends the talk (its reply follows it).
                    "has-quote": ifNode({
                        label: { vi: "Đã có báo giá?", en: "Quote held?" },
                        when: equals(ref("steps.open.output.quoted"), true),
                        yes: endRound,
                        no: "ask",
                    }),
                },
            },
            next: "settled",
            exhausted: "quiet",
        }),
        // The talk ended on its understand step (agree with a quote held, paid, no): that output is the loop's `last`. Else a declined
        // step ended it (its own output, `declined` true, is `last`; the engine already told the team), or the person went quiet (a
        // round of control steps only: `last` is null).
        settled: ifNode({
            label: { vi: "Khách đã trả lời rõ?", en: "Did the customer answer?" },
            when: present(ended("branch")),
            yes: "agree-said",
            no: "declined-said",
        }),
        "declined-said": ifNode({
            label: { vi: "Bị từ chối duyệt?", en: "Declined?" },
            when: equals(ended("declined"), true),
            yes: DECLINED_END,
            no: "quiet",
        }),
        "agree-said": ifNode({
            label: { vi: "Khách đồng ý?", en: "Customer agreed?" },
            when: equals(ended("branch"), "agree"),
            yes: "agreed-reply",
            no: "paid-said",
        }),
        "paid-said": ifNode({
            label: { vi: "Khách báo đã chuyển khoản?", en: "Customer says paid?" },
            when: equals(ended("branch"), "paid"),
            yes: "paid-reply",
            no: "lose",
        }),
        "agreed-reply": node(websalesHeardReplyNode, {
            input: heardInput("agreed"),
            next: "agreed-notify",
            unsuccessful: endsDeclined([purchaseFact(ended("purchaseCode"))]),
        }),
        "agreed-notify": node(websalesHeardNotifyNode, { input: heardNotifyInput("agreed"), next: "agreed" }),
        agreed: outcome({
            name: "agreed",
            label: { vi: "Khách đồng ý", en: "Agreed" },
            output: {
                purchaseId: ref("steps.agreed-reply.output.purchaseId"),
                purchaseCode: ref("steps.agreed-reply.output.purchaseCode"),
            },
        }),
        "paid-reply": node(websalesHeardReplyNode, {
            input: heardInput("paid"),
            next: "paid-notify",
            unsuccessful: endsDeclined([purchaseFact(ended("purchaseCode"))]),
        }),
        "paid-notify": node(websalesHeardNotifyNode, { input: heardNotifyInput("paid") }),
        lose: node(websalesPurchaseLoseNode, {
            input: { ...ENDED_PURCHASE, text: ended("text"), summary: ended("summary"), locale: LOCALE },
            next: "lost-notify",
            unsuccessful: endsDeclined([purchaseFact(ended("purchaseCode"))]),
        }),
        "lost-notify": node(websalesLostNotifyNode, {
            input: {
                purchaseCode: ref("steps.lose.output.purchaseCode"),
                summary: ended("summary"),
                reason: ref("steps.lose.output.reason"),
                locale: LOCALE,
            },
            next: "lost-end",
        }),
        "lost-end": outcome({
            name: "lost",
            label: { vi: "Khách không mua", en: "Lost" },
            output: { purchaseId: ref("steps.lose.output.purchaseId"), reason: ref("steps.lose.output.reason") },
        }),
        [DECLINED_END]: declinedEnd(),
        // The person went quiet, or the talk ran out of rounds: the run ends; a later message starts at the front door again.
        quiet: outcome({ name: "quiet", label: { vi: "Khách im lặng", en: "Customer went quiet" } }),
    },
})
