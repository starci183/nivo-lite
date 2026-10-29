import { bookingSettingsEntities } from "@modules/domain/booking-settings"

const [BookingSettingEntity] = bookingSettingsEntities

/** The settings workspace `ws-1` saved, in the Ho Chi Minh time zone. */
export const savedBookingSettingRow = (): InstanceType<typeof BookingSettingEntity> =>
    Object.assign(new BookingSettingEntity(), {
        workspaceId: "ws-1",
        timezone: "Asia/Ho_Chi_Minh",
        slotStepMin: 15,
        minLeadMin: 0,
        maxAdvanceDays: 30,
        cancelWindowHours: 0,
        depositPct: 0,
        lateCancelFeePct: 0,
        noShowFeeVnd: "0",
        autoConfirm: false,
        handoffOrder: false,
        reminderHours: [],
        publicEnabled: false,
        publicSlug: null,
        publicNote: "",
        address: "",
        updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    })

/** The row of workspace `ws-1` whose public page is on under the slug `salon`. */
export const publishedBookingSettingRow = (): InstanceType<typeof BookingSettingEntity> =>
    Object.assign(savedBookingSettingRow(), {
        publicEnabled: true,
        publicSlug: "salon",
        publicNote: "Hi",
        address: "1 Road",
    })
