import { builder } from "@starci/jest-preset"
import type { Shift, ShiftStaff } from "@modules/domain/shifts"

/** A staff member of the shop with the fields a spec changes overridden. */
export const performerStaffOf = builder<ShiftStaff>({
    id: "staff-1",
    name: "Alice",
    positionIds: ["position-1"],
    skills: [],
    wage: 30000,
    maxWeek: 40,
    maxDay: 8,
    minRest: 12,
    staffRowId: "office-staff-1",
    active: true,
    telegramChatId: null,
    zaloUserId: null,
    phone: null,
})

/** A published 08:00 to 10:00 shift of the first staff member with the fields a spec changes overridden. */
export const performerShiftOf = builder<Shift>({
    id: "shift-1",
    date: "2026-10-12",
    start: "08:00",
    end: "10:00",
    positionId: "position-1",
    staffId: "staff-1",
    status: "published",
})
