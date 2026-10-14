"use client"

import { create } from "zustand"

interface ShiftsWeekStore {
    /** Any date inside the week on screen; `null` = the week of today. */
    readonly monday: string | null
    readonly setMonday: (monday: string | null) => void
}

/** The week the Shifts week blocks share: the bar moves it, the stats, coverage and grid follow it. */
export const useShiftsWeekStore = create<ShiftsWeekStore>((set) => ({
    monday: null,
    setMonday: (monday) => set({ monday }),
}))
