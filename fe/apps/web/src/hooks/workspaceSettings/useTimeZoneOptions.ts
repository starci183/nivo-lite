"use client"

import { useMemo } from "react"
import { knownTimeZones, timeZoneOptionsOf, type TimeZoneOption } from "@/modules/workspaceSettings"

/** The time zones this browser lists, in alphabetical order, with the workspace's saved zone always among them. */
export const useTimeZoneOptions = (saved: string | undefined): ReadonlyArray<TimeZoneOption> =>
    useMemo(() => timeZoneOptionsOf(knownTimeZones(), saved), [saved])
