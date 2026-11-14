import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    absent,
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
    ref,
    round,
    trigger,
    wait,
    waitFor,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../../../shared/bounds"
import { bilingualOf, messageOf } from "../../../shared/messages/catalog"
import { bookingBookNode } from "../nodes/book.node"
import { bookingConfirmNotifyNode } from "../nodes/confirm-notify.node"
import { bookingConfirmTellNode } from "../nodes/confirm-tell.node"
import { bookingConfirmNode } from "../nodes/confirm.node"
import { bookingFindSlotsNode } from "../nodes/find-slots.node"
import { teamDeclinedNoticeNode } from "../../../shared/team-chat/team/declined-notice.node"

/** The key of the booking workflow inside the Booking agent. */
export const BOOK_GRAPH_KEY = "booking.book"

/** How far ahead the free times are offered, in days. */
const OFFER_DAYS = 7

/** What a caller gives the booking: the conversation and the customer's words; the channel and the customer's core contact and the recent lines of the conversation when it knows them (the front desk's hand-off). */
const input = z.object({
    conversationId: z.string().min(1).max(MAX_ID),
    text: z.string().max(MAX_BODY),
    channel: z.string().min(1).max(MAX_ID).nullable().optional(),
    contactId: z.string().min(1).max(MAX_ID).nullable().optional(),
    recentLines: z.array(z.unknown()).nullish(),
})


/** The language of the team notices. */
const LOCALE = "vi"

/** The customer message verbs the booking's wait listens for: the person writes on any of the front desk's channels. */
const SAID = {
    zalo: waitFor(TRIGGER.zaloMessageReceived),
    telegram: waitFor(TRIGGER.telegramMessageReceived),
    facebook: waitFor(TRIGGER.facebookMessageReceived),
    instagram: waitFor(TRIGGER.instagramMessageReceived),
} as const

/** The rounds of the talk: one per customer message (a body that parks at a wait may run 30, R9). */
const TALK_ROUNDS = 30

/** The booking step's last word, read after the talk through the loop's `last` (the book step that ended the final round). */
const lastOf = (member: string) => ref(`steps.talk.output.last.${member}`, { default: null })

/** What the template catalogue shows of `booking.book`. */
const CATALOGUE: TemplateCatalogue = {
    name: bilingualOf("graphBookingBookName"),
    summary: bilingualOf("graphBookingBookSummary"),
    version: 8,
    publishedAt: "2026-11-14T10:30:00.000Z",
    notes: {
        vi: "Mỗi lượt bắt đầu bằng việc chờ tin nhắn của khách (lượt đầu dùng tin nhắn được chuyển sang); tin nhắn không nói về việc đặt lịch được trả lại lễ tân",
        en: "Each round starts by taking the customer's message (round 1 uses the handed-on one); a message not about booking goes back to the front desk",
    },
}

/**
 * `booking.book` version 8: THE BOOKING AS ONE RUN (owner's final rule 8, the same shape as the sale, ruling R33). The caller's params
 * arrive in the event's data (`trigger.data`).
 * - TALK LOOP (`talk`, until the booking is recorded or declined, at most 30 rounds): round 1 has no event and goes straight to `slots`
 *   with the hand-off's words; every later round first parks at `hear` for the person's next message (a day at most). `slots` offers the
 *   free times, ONE `book` step settles the booking against the transcript the round before carried (`{ round: "previous" }`); `asked`
 *   ends the round. Not about a booking (`off`, the model's judgement): a round that waited hands its message back; round 1 ends the
 *   talk and the run ends `not-booking`. The person going quiet ends the talk (`quiet`).
 * - CONFIRMATION: `confirm` (asked of a person) -> `tell` the customer -> `notify` the team -> `booked`.
 * - A declined step tells the team (`team.declined-notice`) and ends `declined`; the team's own post (`notify`) does not.
 */
export const bookingBookGraph: TemplateGraph = defineTemplateGraph({
    key: BOOK_GRAPH_KEY,
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({ data: input }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "talk",
    nodes: {
        talk: loop({
            until: or(
                equals(ref("steps.book.output.branch", { default: null }), "booked"),
                equals(ref("steps.book.output.branch", { default: null }), "declined"),
                equals(ref("steps.hear.output.trigger", { default: null }), "timeout"),
                // Round 1 (no wait ran yet) judged not about a booking: nothing to hand back, the run ends `not-booking`.
                and(equals(ref("steps.book.output.branch", { default: null }), "off"), absent(ref("steps.hear.output.trigger", { default: null }))),
            ),
            max: TALK_ROUNDS,
            body: {
                start: "opening",
                nodes: {
                    // Round 1 has no event: its message is the hand-off's words. Every later round takes the person's next message first.
                    opening: ifNode({ when: equals(round(), 1), yes: "slots", no: "hear" }),
                    hear: wait({
                        for: SAID,
                        timeout: "1d",
                        next: { zalo: "slots", telegram: "slots", facebook: "slots", instagram: "slots", timeout: endRound },
                    }),
                    slots: node(bookingFindSlotsNode, { input: { days: OFFER_DAYS }, next: "book" }),
                    book: node(bookingBookNode, {
                        input: {
                            conversationId: ref("trigger.data.conversationId"),
                            text: ref("trigger.data.text"),
                            // THIS round's message (null in round 1: the hand-off's `text` is the message then).
                            latest: ref("steps.hear.output.event.data.text", { default: null }),
                            history: ref("steps.book.output.transcript", { round: "previous", default: null }),
                            contactId: ref("trigger.data.contactId", { default: null }),
                            recentLines: ref("trigger.data.recentLines", { default: null }),
                            timeZone: ref("steps.slots.output.timeZone"),
                            services: ref("steps.slots.output.services"),
                        },
                        routes: { asked: endRound, booked: endRound, declined: endRound, off: "off-round" },
                    }),
                    // Not about a booking: a round that waited hands its message back; round 1 ends the talk.
                    "off-round": ifNode({ when: equals(round(), 1), yes: endRound, no: "give-back-talk" }),
                    "give-back-talk": handBack({ wait: "hear" }),
                },
            },
            next: "settled",
            exhausted: "quiet",
        }),
        settled: ifNode({ when: equals(lastOf("branch"), "booked"), yes: "confirm", no: "not-booking-said" }),
        // The talk stopped and neither `book` nor the wait ended its last round: round 1's "not about a booking" (`off-round`) did.
        "not-booking-said": ifNode({
            when: and(absent(lastOf("branch")), absent(lastOf("trigger"))),
            yes: "not-booking",
            no: "declined-said",
        }),
        "not-booking": outcome({ name: "not-booking" }),
        "declined-said": ifNode({ when: equals(lastOf("branch"), "declined"), yes: "book-declined-notice", no: "quiet" }),
        "book-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf(LOCALE, "nodeBookingBookTitle"), ref: null, locale: LOCALE },
            next: "declined",
        }),
        confirm: node(bookingConfirmNode, {
            input: { bookingId: lastOf("bookingId") },
            routes: { confirmed: "tell", declined: "declined-notice", settled: "booked" },
        }),
        "declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf(LOCALE, "nodeBookingConfirmTitle"), ref: lastOf("bookingId"), locale: LOCALE },
            next: "declined",
        }),
        tell: node(bookingConfirmTellNode, {
            input: { bookingId: lastOf("bookingId") },
            routes: { told: "notify", declined: "tell-declined-notice" },
        }),
        "tell-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf(LOCALE, "nodeBookingConfirmTellTitle"), ref: lastOf("bookingId"), locale: LOCALE },
            next: "declined",
        }),
        notify: node(bookingConfirmNotifyNode, {
            input: { title: ref("steps.tell.output.teamTitle"), text: ref("steps.tell.output.teamText") },
            next: "notify-declined",
        }),
        "notify-declined": ifNode({ when: equals(ref("steps.notify.output.result"), "declined"), yes: "declined", no: "booked" }),
        booked: outcome({ name: "booked" }),
        declined: outcome({ name: "declined" }),
        // The person went quiet before the booking was settled: the run ends; a later message starts at the front desk again.
        quiet: outcome({ name: "quiet" }),
    },
})
