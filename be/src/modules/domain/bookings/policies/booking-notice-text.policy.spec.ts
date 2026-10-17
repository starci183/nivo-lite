import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { BOOKINGS_MESSAGES } from "../messages/bookings.messages"
import {
    cancelledText,
    confirmedText,
    fillReminderBody,
    movedText,
    noShowText,
    REMINDER_NEUTRAL,
    reminderText,
    reminderVariables,
    vndText,
    whenParts,
    whenText,
} from "./booking-notice-text.policy"
import type { NoticeFacts, Say } from "./booking-notice-text.policy"

type Subject = {
    whenParts: typeof whenParts
    vndText: typeof vndText
    whenText: typeof whenText
    confirmedText: typeof confirmedText
    movedText: typeof movedText
    cancelledText: typeof cancelledText
    noShowText: typeof noShowText
    reminderText: typeof reminderText
    reminderVariables: typeof reminderVariables
    fillReminderBody: typeof fillReminderBody
}

const SUBJECT = Symbol("booking-notice-text.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    whenParts,
                    vndText,
                    whenText,
                    confirmedText,
                    movedText,
                    cancelledText,
                    noShowText,
                    reminderText,
                    reminderVariables,
                    fillReminderBody,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const HCM = "Asia/Ho_Chi_Minh"
const START = Date.UTC(2026, 9, 9, 7, 30)
const FROM = Date.UTC(2026, 9, 8, 2)
const say: Say = (key, params = {}) => {
    const template = BOOKINGS_MESSAGES.vi[key]
    expect(template).toBeDefined()
    return Object.entries(params).reduce(
        (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
        template ?? "",
    )
}
const factsOf = builder<NoticeFacts>({
    shop: "NIVO Salon",
    customer: "An",
    service: "Cut",
    resource: "Linh",
    startMs: START,
    timezone: HCM,
    address: "12 Nguy\u1ec5n Hu\u1ec7",
    depositVnd: 50_000,
    cancelWindowHours: 24,
    fromMs: FROM,
    feeVnd: 50_000,
})

describe("booking-notice-text.policy", () => {
    describe("whenParts", () => {
        it("reads the clock, ISO weekday and padded date in the business timezone", async () => {
            const subject = await build()

            expect(subject.whenParts(START, HCM)).toEqual({
                time: "14:30",
                weekday: 5,
                day: "09",
                month: "10",
                year: "2026",
            })
            expect(subject.whenParts(Date.UTC(2026, 11, 31, 17, 5), HCM)).toEqual({
                time: "00:05",
                weekday: 5,
                day: "01",
                month: "01",
                year: "2027",
            })
        })
    })

    describe("whenText", () => {
        it.each([
            { day: 5, expected: "14:30 th\u1ee9 Hai, 05/10/2026" },
            { day: 6, expected: "14:30 th\u1ee9 Ba, 06/10/2026" },
            { day: 7, expected: "14:30 th\u1ee9 T\u01b0, 07/10/2026" },
            { day: 8, expected: "14:30 th\u1ee9 N\u0103m, 08/10/2026" },
            { day: 9, expected: "14:30 th\u1ee9 S\u00e1u, 09/10/2026" },
            { day: 10, expected: "14:30 th\u1ee9 B\u1ea3y, 10/10/2026" },
            { day: 11, expected: "14:30 Ch\u1ee7 nh\u1eadt, 11/10/2026" },
        ])("uses the old Vietnamese wording for October $day", async ({ day, expected }) => {
            const subject = await build()

            expect(subject.whenText(say, Date.UTC(2026, 9, day, 7, 30), HCM)).toBe(expected)
        })
    })

    describe("vndText", () => {
        it("uses Vietnamese thousands separators, a regular space and the dong sign", async () => {
            const subject = await build()

            expect(subject.vndText(50_000)).toBe("50.000 \u20ab")
            expect(subject.vndText(0)).toBe("0 \u20ab")
        })
    })
})

describe("booking-notice-text.policy", () => {
    describe("confirmedText", () => {
        it("joins the full confirmation, address, deposit and change window with one space", async () => {
            const subject = await build()

            expect(subject.confirmedText(say, factsOf())).toBe(
                "Ch\u00e0o An, NIVO Salon \u0111\u00e3 x\u00e1c nh\u1eadn l\u1ecbch h\u1eb9n: Cut, " +
                    "l\u00fac 14:30 th\u1ee9 S\u00e1u, 09/10/2026 (Linh). " +
                    "\u0110\u1ecba ch\u1ec9: 12 Nguy\u1ec5n Hu\u1ec7. Ti\u1ec1n \u0111\u1eb7t c\u1ecdc " +
                    "50.000 \u20ab, NIVO Salon s\u1ebd nh\u1eafn c\u00e1ch chuy\u1ec3n kho\u1ea3n. " +
                    "B\u1ea1n \u0111\u1ed5i ho\u1eb7c h\u1ee7y tr\u01b0\u1edbc 24 gi\u1edd th\u00ec " +
                    "kh\u00f4ng m\u1ea5t ph\u00ed nh\u00e9.",
            )
        })

        it("leaves out an absent resource", async () => {
            const subject = await build()

            expect(subject.confirmedText(say, factsOf({ resource: "" }))).toBe(
                "Ch\u00e0o An, NIVO Salon \u0111\u00e3 x\u00e1c nh\u1eadn l\u1ecbch h\u1eb9n: Cut, " +
                    "l\u00fac 14:30 th\u1ee9 S\u00e1u, 09/10/2026. " +
                    "\u0110\u1ecba ch\u1ec9: 12 Nguy\u1ec5n Hu\u1ec7. Ti\u1ec1n \u0111\u1eb7t c\u1ecdc " +
                    "50.000 \u20ab, NIVO Salon s\u1ebd nh\u1eafn c\u00e1ch chuy\u1ec3n kho\u1ea3n. " +
                    "B\u1ea1n \u0111\u1ed5i ho\u1eb7c h\u1ee7y tr\u01b0\u1edbc 24 gi\u1edd th\u00ec " +
                    "kh\u00f4ng m\u1ea5t ph\u00ed nh\u00e9.",
            )
        })

        it("leaves out an absent address without adding another space", async () => {
            const subject = await build()

            expect(subject.confirmedText(say, factsOf({ address: "" }))).toBe(
                "Ch\u00e0o An, NIVO Salon \u0111\u00e3 x\u00e1c nh\u1eadn l\u1ecbch h\u1eb9n: Cut, " +
                    "l\u00fac 14:30 th\u1ee9 S\u00e1u, 09/10/2026 (Linh). " +
                    "Ti\u1ec1n \u0111\u1eb7t c\u1ecdc 50.000 \u20ab, NIVO Salon s\u1ebd nh\u1eafn c\u00e1ch " +
                    "chuy\u1ec3n kho\u1ea3n. " +
                    "B\u1ea1n \u0111\u1ed5i ho\u1eb7c h\u1ee7y tr\u01b0\u1edbc 24 gi\u1edd th\u00ec " +
                    "kh\u00f4ng m\u1ea5t ph\u00ed nh\u00e9.",
            )
        })

        it("leaves out a zero deposit without adding another space", async () => {
            const subject = await build()

            expect(subject.confirmedText(say, factsOf({ depositVnd: 0 }))).toBe(
                "Ch\u00e0o An, NIVO Salon \u0111\u00e3 x\u00e1c nh\u1eadn l\u1ecbch h\u1eb9n: Cut, " +
                    "l\u00fac 14:30 th\u1ee9 S\u00e1u, 09/10/2026 (Linh). " +
                    "\u0110\u1ecba ch\u1ec9: 12 Nguy\u1ec5n Hu\u1ec7. B\u1ea1n \u0111\u1ed5i ho\u1eb7c " +
                    "h\u1ee7y tr\u01b0\u1edbc 24 gi\u1edd th\u00ec kh\u00f4ng m\u1ea5t ph\u00ed nh\u00e9.",
            )
        })

        it("leaves out a zero change window without adding a trailing space", async () => {
            const subject = await build()

            expect(subject.confirmedText(say, factsOf({ cancelWindowHours: 0 }))).toBe(
                "Ch\u00e0o An, NIVO Salon \u0111\u00e3 x\u00e1c nh\u1eadn l\u1ecbch h\u1eb9n: Cut, " +
                    "l\u00fac 14:30 th\u1ee9 S\u00e1u, 09/10/2026 (Linh). " +
                    "\u0110\u1ecba ch\u1ec9: 12 Nguy\u1ec5n Hu\u1ec7. Ti\u1ec1n \u0111\u1eb7t c\u1ecdc " +
                    "50.000 \u20ab, NIVO Salon s\u1ebd nh\u1eafn c\u00e1ch chuy\u1ec3n kho\u1ea3n.",
            )
        })
    })
})

describe("booking-notice-text.policy", () => {
    describe("confirmedText", () => {
        it.each(["", " \t "])("greets the blank customer %p neutrally with no optional parts", async (customer) => {
            const subject = await build()

            expect(
                subject.confirmedText(
                    say,
                    factsOf({ customer, resource: "", address: "", depositVnd: 0, cancelWindowHours: 0 }),
                ),
            ).toBe(
                "Ch\u00e0o b\u1ea1n, NIVO Salon \u0111\u00e3 x\u00e1c nh\u1eadn l\u1ecbch h\u1eb9n: " +
                    "Cut, l\u00fac 14:30 th\u1ee9 S\u00e1u, 09/10/2026.",
            )
        })
    })
})

describe("booking-notice-text.policy", () => {
    describe("confirmedText", () => {
        it("trims a customer's name before greeting them", async () => {
            const subject = await build()

            expect(
                subject.confirmedText(
                    say,
                    factsOf({ customer: " An ", resource: "", address: "", depositVnd: 0, cancelWindowHours: 0 }),
                ),
            ).toBe(
                "Ch\u00e0o An, NIVO Salon \u0111\u00e3 x\u00e1c nh\u1eadn l\u1ecbch h\u1eb9n: Cut, " +
                    "l\u00fac 14:30 th\u1ee9 S\u00e1u, 09/10/2026.",
            )
        })
    })
})

describe("booking-notice-text.policy", () => {
    describe("movedText", () => {
        it("writes the previous time, new time and resource", async () => {
            const subject = await build()

            expect(subject.movedText(say, factsOf())).toBe(
                "Ch\u00e0o An, NIVO Salon \u0111\u00e3 \u0111\u1ed5i l\u1ecbch Cut c\u1ee7a b\u1ea1n " +
                    "t\u1eeb 09:00 th\u1ee9 N\u0103m, 08/10/2026 " +
                    "sang 14:30 th\u1ee9 S\u00e1u, 09/10/2026 (Linh).",
            )
        })

        it("leaves out the resource when it is absent", async () => {
            const subject = await build()

            expect(subject.movedText(say, factsOf({ resource: "" }))).toBe(
                "Ch\u00e0o An, NIVO Salon \u0111\u00e3 \u0111\u1ed5i l\u1ecbch Cut c\u1ee7a b\u1ea1n " +
                    "t\u1eeb 09:00 th\u1ee9 N\u0103m, 08/10/2026 " +
                    "sang 14:30 th\u1ee9 S\u00e1u, 09/10/2026.",
            )
        })

        it("falls back to the current start when there is no previous time", async () => {
            const subject = await build()

            expect(subject.movedText(say, factsOf({ fromMs: null }))).toBe(
                "Ch\u00e0o An, NIVO Salon \u0111\u00e3 \u0111\u1ed5i l\u1ecbch Cut c\u1ee7a b\u1ea1n " +
                    "t\u1eeb 14:30 th\u1ee9 S\u00e1u, 09/10/2026 " +
                    "sang 14:30 th\u1ee9 S\u00e1u, 09/10/2026 (Linh).",
            )
        })

        it("uses a recorded previous time of zero rather than falling back to the start", async () => {
            const subject = await build()

            expect(subject.movedText(say, factsOf({ fromMs: 0, resource: "" }))).toBe(
                "Ch\u00e0o An, NIVO Salon \u0111\u00e3 \u0111\u1ed5i l\u1ecbch Cut c\u1ee7a b\u1ea1n " +
                    "t\u1eeb 08:00 th\u1ee9 N\u0103m, 01/01/1970 " +
                    "sang 14:30 th\u1ee9 S\u00e1u, 09/10/2026.",
            )
        })
    })

    describe("cancelledText", () => {
        it("omits the fee sentence when nothing is owed", async () => {
            const subject = await build()

            expect(subject.cancelledText(say, factsOf({ feeVnd: 0 }))).toBe(
                "Ch\u00e0o An, NIVO Salon \u0111\u00e3 h\u1ee7y l\u1ecbch Cut l\u00fac 14:30 th\u1ee9 " +
                    "S\u00e1u, 09/10/2026 " +
                    "theo y\u00eau c\u1ea7u c\u1ee7a b\u1ea1n. H\u1eb9n b\u1ea1n d\u1ecbp kh\u00e1c nh\u00e9.",
            )
        })

        it("includes the exact old late-cancellation fee sentence", async () => {
            const subject = await build()

            expect(subject.cancelledText(say, factsOf())).toBe(
                "Ch\u00e0o An, NIVO Salon \u0111\u00e3 h\u1ee7y l\u1ecbch Cut l\u00fac 14:30 th\u1ee9 " +
                    "S\u00e1u, 09/10/2026 theo y\u00eau c\u1ea7u c\u1ee7a b\u1ea1n. " +
                    "Theo ch\u00ednh s\u00e1ch, ph\u00ed h\u1ee7y s\u00e1t gi\u1edd l\u00e0 50.000 \u20ab. " +
                    "H\u1eb9n b\u1ea1n d\u1ecbp kh\u00e1c nh\u00e9.",
            )
        })
    })
})

describe("booking-notice-text.policy", () => {
    describe("noShowText", () => {
        it.each([
            { feeVnd: 0, fee: "0 \u20ab" },
            { feeVnd: 50_000, fee: "50.000 \u20ab" },
        ])("always writes the fee, including $fee", async ({ feeVnd, fee }) => {
            const subject = await build()

            expect(subject.noShowText(say, factsOf({ feeVnd }))).toBe(
                "Ch\u00e0o An, NIVO Salon ghi nh\u1eadn b\u1ea1n kh\u00f4ng \u0111\u1ebfn l\u1ecbch Cut " +
                    "l\u00fac 14:30 th\u1ee9 S\u00e1u, 09/10/2026. " +
                    `Theo ch\u00ednh s\u00e1ch, ph\u00ed l\u00e0 ${fee}. B\u1ea1n nh\u1eafn l\u1ea1i ` +
                    "n\u1ebfu c\u00f3 nh\u1ea7m l\u1eabn nh\u00e9.",
            )
        })
    })
})

describe("booking-notice-text.policy", () => {
    describe("reminderText", () => {
        it("writes the full reminder with the hours remaining, resource and address", async () => {
            const subject = await build()

            expect(subject.reminderText(say, factsOf(), 24)).toBe(
                "Ch\u00e0o An, NIVO Salon nh\u1eafc b\u1ea1n c\u00f3 l\u1ecbch Cut l\u00fac 14:30 " +
                    "th\u1ee9 S\u00e1u, 09/10/2026 (Linh), " +
                    "c\u00f2n kho\u1ea3ng 24 gi\u1edd n\u1eefa. \u0110\u1ecba ch\u1ec9: 12 Nguy\u1ec5n " +
                    "Hu\u1ec7. B\u1ea1n nh\u1eafn l\u1ea1i n\u1ebfu c\u1ea7n \u0111\u1ed5i gi\u1edd nh\u00e9.",
            )
        })

        it.each([0, 0.5])("omits the hours remaining when only %p hours remain", async (hoursBefore) => {
            const subject = await build()

            expect(subject.reminderText(say, factsOf(), hoursBefore)).toBe(
                "Ch\u00e0o An, NIVO Salon nh\u1eafc b\u1ea1n c\u00f3 l\u1ecbch Cut l\u00fac 14:30 " +
                    "th\u1ee9 S\u00e1u, 09/10/2026 (Linh). " +
                    "\u0110\u1ecba ch\u1ec9: 12 Nguy\u1ec5n Hu\u1ec7. B\u1ea1n nh\u1eafn l\u1ea1i n\u1ebfu " +
                    "c\u1ea7n \u0111\u1ed5i gi\u1edd nh\u00e9.",
            )
        })

        it("includes the exact one-hour edge and omits an absent address", async () => {
            const subject = await build()

            expect(subject.reminderText(say, factsOf({ address: "" }), 1)).toBe(
                "Ch\u00e0o An, NIVO Salon nh\u1eafc b\u1ea1n c\u00f3 l\u1ecbch Cut l\u00fac 14:30 " +
                    "th\u1ee9 S\u00e1u, 09/10/2026 (Linh), " +
                    "c\u00f2n kho\u1ea3ng 1 gi\u1edd n\u1eefa. B\u1ea1n nh\u1eafn l\u1ea1i n\u1ebfu " +
                    "c\u1ea7n \u0111\u1ed5i gi\u1edd nh\u00e9.",
            )
        })

        it("omits an absent resource while retaining the address and time remaining", async () => {
            const subject = await build()

            expect(subject.reminderText(say, factsOf({ resource: "" }), 24)).toBe(
                "Ch\u00e0o An, NIVO Salon nh\u1eafc b\u1ea1n c\u00f3 l\u1ecbch Cut l\u00fac 14:30 " +
                    "th\u1ee9 S\u00e1u, 09/10/2026, " +
                    "c\u00f2n kho\u1ea3ng 24 gi\u1edd n\u1eefa. \u0110\u1ecba ch\u1ec9: 12 Nguy\u1ec5n " +
                    "Hu\u1ec7. B\u1ea1n nh\u1eafn l\u1ea1i n\u1ebfu c\u1ea7n \u0111\u1ed5i gi\u1edd nh\u00e9.",
            )
        })

        it.each([0, 0.5])("omits all absent optional parts with %p hours remaining", async (hoursBefore) => {
            const subject = await build()

            expect(subject.reminderText(say, factsOf({ resource: "", address: "" }), hoursBefore)).toBe(
                "Ch\u00e0o An, NIVO Salon nh\u1eafc b\u1ea1n c\u00f3 l\u1ecbch Cut l\u00fac 14:30 " +
                    "th\u1ee9 S\u00e1u, 09/10/2026. " +
                    "B\u1ea1n nh\u1eafn l\u1ea1i n\u1ebfu c\u1ea7n \u0111\u1ed5i gi\u1edd nh\u00e9.",
            )
        })
    })
})

describe("booking-notice-text.policy", () => {
    describe("reminderVariables and REMINDER_NEUTRAL", () => {
        it("exposes exactly the six old template variable names and their facts", async () => {
            const subject = await build()

            expect(subject.reminderVariables(say, factsOf())).toEqual({
                ten_khach: "An",
                ten_shop: "NIVO Salon",
                dich_vu: "Cut",
                gio_hen: "14:30 th\u1ee9 S\u00e1u, 09/10/2026",
                nguoi_lam: "Linh",
                dia_chi: "12 Nguy\u1ec5n Hu\u1ec7",
            })
            expect(REMINDER_NEUTRAL).toEqual(["ten_khach", "ten_shop", "dich_vu", "gio_hen", "nguoi_lam", "dia_chi"])
        })

        it("passes blank variables through for the template's neutral replacement", async () => {
            const subject = await build()

            expect(
                subject.reminderVariables(
                    say,
                    factsOf({ customer: " ", shop: "", service: "", resource: "", address: "" }),
                ),
            ).toEqual({
                ten_khach: " ",
                ten_shop: "",
                dich_vu: "",
                gio_hen: "14:30 th\u1ee9 S\u00e1u, 09/10/2026",
                nguoi_lam: "",
                dia_chi: "",
            })
        })
    })

    describe("fillReminderBody", () => {
        it("fills each occurrence from trimmed variable values", async () => {
            const subject = await build()

            expect(
                subject.fillReminderBody(
                    " Ch\u00e0o {ten_khach}, l\u1ecbch {dich_vu} l\u00fac {gio_hen} ({nguoi_lam}). H\u1eb9n " +
                        "{ten_khach}! ",
                    { ...subject.reminderVariables(say, factsOf()), ten_khach: " An " },
                    {},
                ),
            ).toBe("Ch\u00e0o An, l\u1ecbch Cut l\u00fac 14:30 th\u1ee9 S\u00e1u, 09/10/2026 (Linh). H\u1eb9n An!")
        })

        it("uses neutral words for blank or missing variables and removes gaps before punctuation", async () => {
            const subject = await build()

            expect(
                subject.fillReminderBody(
                    "  {ten_khach}\t {missing}, {ten_shop} {blank} !  {absent_neutral} ?  ",
                    { ten_khach: " An ", ten_shop: " \t ", blank: "" },
                    { ten_shop: "shop" },
                ),
            ).toBe("An, shop!?")
        })

        it("preserves literal text, line breaks and unsupported placeholder syntax", async () => {
            const subject = await build()

            expect(
                subject.fillReminderBody("Ch\u00e0o {Ten_Khach}\n{ten-khach}.\nH\u1eb9n g\u1eb7p l\u1ea1i.", {}, {}),
            ).toBe("Ch\u00e0o {Ten_Khach}\n{ten-khach}.\nH\u1eb9n g\u1eb7p l\u1ea1i.")
        })
    })
})
