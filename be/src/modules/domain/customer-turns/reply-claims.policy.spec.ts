import { Test } from "@nestjs/testing"
import { NO_ORDER, claimTruthOf, unclaimedReplyOf } from "./reply-claims.policy"
const SUBJECT = Symbol("reply-claims.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { claimTruthOf, unclaimedReplyOf } }],
    }).compile()
    return moduleRef.get<typeof import("./reply-claims.policy")>(SUBJECT)
}

const NEUTRAL =
    "C\u1ea3m \u01a1n b\u1ea1n! Shop \u0111\u00e3 nh\u1eadn \u0111\u01b0\u1ee3c tin nh\u1eafn v\u00e0 s\u1ebd ph\u1ea3n h\u1ed3i b\u1ea1n s\u1edbm nh\u00e9."

/** The r28 live probe, Sales, 5 x 3.500.000: the reply claimed the order went for approval, and no order or approval existed. */
const R28_REPLY =
    "D\u1ea1 em ch\u00e0o anh Minh. Anh \u0111\u1eb7t 5 gi\u1ecf hoa nh\u1ecf, \u0111\u01a1n gi\u00e1 3.500.000 \u0111\u1ed3ng, t\u1ed5ng 17.500.000 \u0111\u1ed3ng \u1ea1. \u0110\u01a1n n\u00e0y tr\u00ean 5.000.000 \u0111\u1ed3ng n\u00ean em xin ph\u00e9p g\u1eedi ch\u1ee7 c\u1eeda h\u00e0ng duy\u1ec7t tr\u01b0\u1edbc, em s\u1ebd b\u00e1o anh ngay khi c\u00f3 k\u1ebft qu\u1ea3. Anh cho em xin \u0111\u1ecba ch\u1ec9 giao hoa v\u00e0 th\u1eddi gian nh\u1eadn nh\u00e9."

describe("unclaimedReplyOf", () => {
    it("drops the r28 sentence that claimed an approval no order of the turn waits for", async () => {
        const subject = await build()

        expect(subject.unclaimedReplyOf(R28_REPLY, NO_ORDER, NEUTRAL)).toBe(
            "D\u1ea1 em ch\u00e0o anh Minh. Anh \u0111\u1eb7t 5 gi\u1ecf hoa nh\u1ecf, \u0111\u01a1n gi\u00e1 3.500.000 \u0111\u1ed3ng, t\u1ed5ng 17.500.000 \u0111\u1ed3ng \u1ea1. Anh cho em xin \u0111\u1ecba ch\u1ec9 giao hoa v\u00e0 th\u1eddi gian nh\u1eadn nh\u00e9.",
        )
    })

    it("lets the same reply leave as it is when the turn's order really waits for the owner", async () => {
        const subject = await build()

        expect(subject.unclaimedReplyOf(R28_REPLY, subject.claimTruthOf("awaiting_approval"), NEUTRAL)).toBe(R28_REPLY)
    })

    it.each([
        [
            "a confirmation of an order only on record",
            "D\u1ea1 \u0111\u01a1n c\u1ee7a anh \u0111\u00e3 \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn.",
            "recorded",
        ],
        [
            "a confirmation in the shop's voice",
            "Em \u0111\u00e3 ch\u1ed1t \u0111\u01a1n cho ch\u1ecb r\u1ed3i \u1ea1.",
            "recorded",
        ],
        ["an English confirmation", "Your order has been confirmed.", undefined],
        [
            "a record of an order that is not there",
            "M\u00ecnh \u0111\u00e3 ghi nh\u1eadn \u0111\u01a1n c\u1ee7a b\u1ea1n.",
            undefined,
        ],
        ["an English record", "We have placed your order.", undefined],
        ["an approval in English", "I sent it for approval.", "confirmed"],
    ] as const)("answers the neutral line for %s", async (_label, reply, state) => {
        const subject = await build()

        expect(subject.unclaimedReplyOf(reply, subject.claimTruthOf(state), NEUTRAL)).toBe(NEUTRAL)
    })

    it.each([
        [
            "a confirmation that happened",
            "\u0110\u01a1n c\u1ee7a anh \u0111\u00e3 \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn.",
            "confirmed",
        ],
        ["a record that happened", "Em \u0111\u00e3 l\u00ean \u0111\u01a1n cho anh.", "recorded"],
        [
            "a reply that claims nothing",
            "Shop s\u1ebd x\u00e1c nh\u1eadn v\u1edbi b\u1ea1n s\u1edbm nh\u00e9.",
            undefined,
        ],
    ] as const)("keeps %s", async (_label, reply, state) => {
        const subject = await build()

        expect(subject.unclaimedReplyOf(reply, subject.claimTruthOf(state), NEUTRAL)).toBe(reply)
    })
})

describe("claimTruthOf", () => {
    it.each([
        ["confirmed", { recorded: true, confirmed: true, awaitingApproval: false }],
        ["awaiting_approval", { recorded: true, confirmed: false, awaitingApproval: true }],
        ["recorded", { recorded: true, confirmed: false, awaitingApproval: false }],
        [null, NO_ORDER],
    ] as const)("reads %s", async (state, truth) => {
        const subject = await build()

        expect(subject.claimTruthOf(state)).toEqual(truth)
    })
})
