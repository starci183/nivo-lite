import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspacesService } from "@modules/domain/workspaces"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { BookingModelService } from "./booking-model.service"
import type { BookingNotice, BookingNoticeKind, BookingNotifier } from "./booking-notice.contracts"
import { BookingNoticesService } from "./booking-notices.service"
import type { BookingSettings } from "./bookings.contracts"
import { BOOKINGS_NOTIFIER } from "./bookings.decorators"
import { BOOKINGS_MESSAGES } from "./messages/bookings.messages"
import { SELECT_BOOKING_FOR_NOTICE } from "./persistence/booking-effects.sql"
import { DEFAULT_SETTINGS } from "./persistence/booking.rows"
import type { EffectsRow } from "./persistence/booking.rows"
import type { NoticeFacts } from "./policies/booking-notice-text.policy"

const WORKSPACE = "ws-1"
const BOOKING_ID = "booking-1"
const START = Date.UTC(2026, 9, 9, 7, 30)
const FROM = Date.UTC(2026, 9, 8, 7, 30)
const WHEN = "14:30 th\u1ee9 S\u00e1u, 09/10/2026"
const FROM_WHEN = "14:30 th\u1ee9 N\u0103m, 08/10/2026"
const factsOf = builder<NoticeFacts>({
    shop: "Nivo Salon",
    customer: "Mai",
    service: "Cut",
    resource: "Lan",
    startMs: START,
    timezone: "Asia/Ho_Chi_Minh",
    address: "12 L\u00ea L\u1ee3i",
    depositVnd: 50000,
    cancelWindowHours: 24,
    fromMs: FROM,
    feeVnd: 50000,
})
const rowOf = builder<EffectsRow>({
    id: BOOKING_ID,
    workspace_id: WORKSPACE,
    status: "confirmed",
    lead_id: "lead-1",
    conversation_id: "conversation-1",
    customer_name: "Mai",
    customer_phone: "84912345678",
    customer_email: "mai@example.com",
    cancel_reason: null,
    reschedule_count: 1,
    service_name: "Cut",
    price_vnd: 200000,
    cancel_fee_vnd: 1000,
    start_ms: START,
    cancelled_ms: null,
    resource_name: "Lan",
    deposit_vnd: 50000,
    from_ms: FROM,
    holds_slot: true,
})
const settingsOf = builder<BookingSettings>({
    ...DEFAULT_SETTINGS,
    timezone: "Asia/Ho_Chi_Minh",
    address: "12 L\u00ea L\u1ee3i",
    cancelWindowHours: 24,
})
const build = async (stubs: ReadonlyArray<readonly [string, unknown]> = [], shop = "Nivo Salon") => {
    const em = mockEntityManager({ query: stubs })
    const models = mock<BookingModelService>()
    models.settings.mockResolvedValue(settingsOf())
    const workspaces = mock<WorkspacesService>()
    workspaces.nameOf.mockResolvedValue(shop)
    const catalog: MessageCatalog = {
        get: (key, params, locale) =>
            (BOOKINGS_MESSAGES[locale][key] ?? key).replace(/\{\{(\w+)\}\}/g, (placeholder, name: string) => {
                const value = params[name]
                return value === undefined ? placeholder : String(value)
            }),
    }
    const notifier = mock<BookingNotifier>()
    const messages = mock<MessageCatalog>()
    messages.get.mockImplementation((key, params, locale) => catalog.get(key, params, locale))
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingNoticesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: MESSAGE_CATALOG, useValue: messages },
            { provide: BookingModelService, useValue: models },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: BOOKINGS_NOTIFIER, useValue: notifier },
        ],
    }).compile()
    return { service: moduleRef.get(BookingNoticesService), em, models, workspaces, messages, catalog, notifier }
}

describe("BookingNoticesService", () => {
    it("reads the booking in its workspace without locking it", async () => {
        const row = rowOf()
        const { service, em } = await build([[SELECT_BOOKING_FOR_NOTICE, [row]]])

        await expect(service.bookingOf(WORKSPACE, BOOKING_ID)).resolves.toBe(row)

        expect(em.query.mock.calls).toEqual([[SELECT_BOOKING_FOR_NOTICE, [WORKSPACE, BOOKING_ID]]])
    })

    it("returns null when the booking query returns no row", async () => {
        const { service, em } = await build([[SELECT_BOOKING_FOR_NOTICE, []]])

        await expect(service.bookingOf(WORKSPACE, BOOKING_ID)).resolves.toBeNull()

        expect(em.query.mock.calls).toEqual([[SELECT_BOOKING_FOR_NOTICE, [WORKSPACE, BOOKING_ID]]])
    })

    it("combines the trimmed workspace name, row, settings and current fee", async () => {
        const { service, workspaces } = await build([], "  Nivo Salon \t")

        await expect(service.factsOf(WORKSPACE, rowOf(), settingsOf(), 50000)).resolves.toEqual(factsOf())

        expect(workspaces.nameOf.mock.calls).toEqual([[WORKSPACE]])
    })

    it.each(["", " \t\n "])("uses NIVO when the workspace name is blank: %j", async (name) => {
        const { service, workspaces } = await build([], name)

        await expect(service.factsOf(WORKSPACE, rowOf(), settingsOf(), 0)).resolves.toEqual(
            factsOf({ shop: "NIVO", feeVnd: 0 }),
        )

        expect(workspaces.nameOf.mock.calls).toEqual([[WORKSPACE]])
    })

    it("preserves empty row facts and the settings chosen by the workspace", async () => {
        const { service } = await build()

        await expect(
            service.factsOf(
                WORKSPACE,
                rowOf({ resource_name: "", deposit_vnd: 0, from_ms: null }),
                settingsOf({ timezone: "UTC", address: "", cancelWindowHours: 0 }),
                1700,
            ),
        ).resolves.toEqual(
            factsOf({
                timezone: "UTC",
                address: "",
                cancelWindowHours: 0,
                resource: "",
                depositVnd: 0,
                fromMs: null,
                feeVnd: 1700,
            }),
        )
    })
})

describe("BookingNoticesService", () => {
    const subjects: ReadonlyArray<{ readonly kind: BookingNoticeKind; readonly text: string }> = [
        { kind: "confirmed", text: "X\u00e1c nh\u1eadn l\u1ecbch h\u1eb9n Cut" },
        { kind: "moved", text: "\u0110\u1ed5i l\u1ecbch h\u1eb9n Cut" },
        { kind: "cancelled", text: "H\u1ee7y l\u1ecbch h\u1eb9n Cut" },
        { kind: "no_show", text: "H\u1ee7y l\u1ecbch h\u1eb9n Cut" },
        { kind: "reminder", text: "Nh\u1eafc l\u1ecbch h\u1eb9n" },
    ]

    it("writes a confirmation with the original Vietnamese wording", async () => {
        const { service } = await build()

        expect(service.textOf("confirmed", factsOf())).toBe(
            "Ch\u00e0o Mai, Nivo Salon \u0111\u00e3 x\u00e1c nh\u1eadn " +
                `l\u1ecbch h\u1eb9n: Cut, l\u00fac ${WHEN} (Lan). ` +
                "\u0110\u1ecba ch\u1ec9: 12 L\u00ea L\u1ee3i. " +
                "Ti\u1ec1n \u0111\u1eb7t c\u1ecdc 50.000 \u20ab, " +
                "Nivo Salon s\u1ebd nh\u1eafn c\u00e1ch chuy\u1ec3n kho\u1ea3n. " +
                "B\u1ea1n \u0111\u1ed5i ho\u1eb7c h\u1ee7y tr\u01b0\u1edbc 24 gi\u1edd " +
                "th\u00ec kh\u00f4ng m\u1ea5t ph\u00ed nh\u00e9.",
        )
    })

    it("writes a moved notice with the previous start", async () => {
        const { service } = await build()

        expect(service.textOf("moved", factsOf())).toBe(
            "Ch\u00e0o Mai, Nivo Salon \u0111\u00e3 \u0111\u1ed5i l\u1ecbch Cut " +
                `c\u1ee7a b\u1ea1n t\u1eeb ${FROM_WHEN} sang ${WHEN} (Lan).`,
        )
    })

    it("writes a cancellation with the fee", async () => {
        const { service } = await build()

        expect(service.textOf("cancelled", factsOf())).toBe(
            `Ch\u00e0o Mai, Nivo Salon \u0111\u00e3 h\u1ee7y l\u1ecbch Cut l\u00fac ${WHEN} ` +
                "theo y\u00eau c\u1ea7u c\u1ee7a b\u1ea1n. " +
                "Theo ch\u00ednh s\u00e1ch, ph\u00ed h\u1ee7y s\u00e1t gi\u1edd l\u00e0 50.000 \u20ab. " +
                "H\u1eb9n b\u1ea1n d\u1ecbp kh\u00e1c nh\u00e9.",
        )
    })

    it("writes a no-show notice with the fee", async () => {
        const { service } = await build()

        expect(service.textOf("no_show", factsOf())).toBe(
            "Ch\u00e0o Mai, Nivo Salon ghi nh\u1eadn b\u1ea1n kh\u00f4ng \u0111\u1ebfn " +
                `l\u1ecbch Cut l\u00fac ${WHEN}. ` +
                "Theo ch\u00ednh s\u00e1ch, ph\u00ed l\u00e0 50.000 \u20ab. " +
                "B\u1ea1n nh\u1eafn l\u1ea1i n\u1ebfu c\u00f3 nh\u1ea7m l\u1eabn nh\u00e9.",
        )
    })

    it.each(subjects)("reads the Vietnamese subject for $kind", async ({ kind, text }) => {
        const { service, messages } = await build()

        expect(service.subjectOf(kind, "Cut")).toBe(text)

        expect(messages.get.mock.calls).toEqual([[`bookings.subject.${kind}`, { service: "Cut" }, "vi"]])
    })
})

describe("BookingNoticesService", () => {
    it.each([null, "", " \t\n "])("uses the fixed reminder for a blank body: %j", async (body) => {
        const { service } = await build()

        expect(service.reminderOf(factsOf(), 24, body)).toBe(
            "Ch\u00e0o Mai, Nivo Salon nh\u1eafc b\u1ea1n c\u00f3 l\u1ecbch Cut " +
                `l\u00fac ${WHEN} (Lan), c\u00f2n kho\u1ea3ng 24 gi\u1edd n\u1eefa. ` +
                "\u0110\u1ecba ch\u1ec9: 12 L\u00ea L\u1ee3i. " +
                "B\u1ea1n nh\u1eafn l\u1ea1i n\u1ebfu c\u1ea7n \u0111\u1ed5i gi\u1edd nh\u00e9.",
        )
    })

    it("fills the owner's custom reminder wording", async () => {
        const { service } = await build()

        expect(
            service.reminderOf(
                factsOf(),
                24,
                "Ch\u00e0o {ten_khach}, l\u1ecbch {dich_vu} l\u00fac {gio_hen}{nguoi_lam}.",
            ),
        ).toBe(`Ch\u00e0o Mai, l\u1ecbch Cut l\u00fac ${WHEN}Lan.`)
    })

    it("fills all six offered variables and trims their values", async () => {
        const { service } = await build()

        expect(
            service.reminderOf(
                factsOf({
                    customer: " Mai ",
                    shop: " Nivo Salon ",
                    resource: " Lan ",
                    address: " 12 L\u00ea L\u1ee3i ",
                }),
                0,
                "{ten_khach}|{ten_shop}|{dich_vu}|{gio_hen}|{nguoi_lam}|{dia_chi}",
            ),
        ).toBe(`Mai|Nivo Salon|Cut|${WHEN}|Lan|12 L\u00ea L\u1ee3i`)
    })
})

describe("BookingNoticesService", () => {
    it("fills blank custom variables with their Vietnamese neutral words", async () => {
        const { service, messages, catalog } = await build()
        messages.get.mockImplementation((key, params, locale) =>
            key === "bookings.notice.when" ? " \t " : catalog.get(key, params, locale),
        )

        expect(
            service.reminderOf(
                factsOf({ customer: " \t ", shop: "", service: " ", resource: "", address: " " }),
                24,
                "Ch\u00e0o {ten_khach}, {ten_shop} nh\u1eafc {dich_vu} l\u00fac {gio_hen} {nguoi_lam} . {dia_chi}",
            ),
        ).toBe("Ch\u00e0o b\u1ea1n, shop nh\u1eafc d\u1ecbch v\u1ee5 l\u00fac gi\u1edd h\u1eb9n.")
        expect(messages.get.mock.calls).toEqual([
            ["bookings.neutral.ten_khach", {}, "vi"],
            ["bookings.neutral.ten_shop", {}, "vi"],
            ["bookings.neutral.dich_vu", {}, "vi"],
            ["bookings.neutral.gio_hen", {}, "vi"],
            ["bookings.neutral.nguoi_lam", {}, "vi"],
            ["bookings.neutral.dia_chi", {}, "vi"],
            ["bookings.weekday.5", {}, "vi"],
            [
                "bookings.notice.when",
                { time: "14:30", weekday: "th\u1ee9 S\u00e1u", day: "09", month: "10", year: "2026" },
                "vi",
            ],
        ])
    })

    it("formats the customer's instant in the supplied timezone", async () => {
        const { service, messages } = await build()

        expect(service.whenOf(START, "Asia/Ho_Chi_Minh")).toBe(WHEN)
        expect(service.whenOf(START, "UTC")).toBe("07:30 th\u1ee9 S\u00e1u, 09/10/2026")

        expect(messages.get.mock.calls).toEqual([
            ["bookings.weekday.5", {}, "vi"],
            [
                "bookings.notice.when",
                { time: "14:30", weekday: "th\u1ee9 S\u00e1u", day: "09", month: "10", year: "2026" },
                "vi",
            ],
            ["bookings.weekday.5", {}, "vi"],
            [
                "bookings.notice.when",
                { time: "07:30", weekday: "th\u1ee9 S\u00e1u", day: "09", month: "10", year: "2026" },
                "vi",
            ],
        ])
    })

    it("delegates workspace settings to the booking model", async () => {
        const { service, models } = await build()
        const settings = settingsOf({ timezone: "UTC", cancelWindowHours: 2 })
        models.settings.mockResolvedValue(settings)

        await expect(service.settingsOf(WORKSPACE)).resolves.toBe(settings)

        expect(models.settings.mock.calls).toEqual([[WORKSPACE]])
    })
})

describe("BookingNoticesService", () => {
    it("hands a notice to the notifier the app registered and answers its result", async () => {
        const { service, notifier } = await build()
        const notice: BookingNotice = {
            workspaceId: WORKSPACE,
            bookingId: BOOKING_ID,
            kind: "reminder",
            leadId: "lead-1",
            conversationId: null,
            email: null,
            subject: "Reminder",
            text: "See you",
            dedupeKey: "remind:1",
        }
        notifier.notify.mockResolvedValue({ delivered: true, kept: true, via: "zalo" })

        await expect(service.deliver(notice)).resolves.toEqual({ delivered: true, kept: true, via: "zalo" })

        expect(notifier.notify.mock.calls).toEqual([[notice]])
    })
})
