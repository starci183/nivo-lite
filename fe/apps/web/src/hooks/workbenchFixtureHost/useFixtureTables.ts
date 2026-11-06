"use client"

import { MODULE_FIXTURES } from "@nivo-lite/blocks-core/fixtures"
import { useLocale } from "next-intl"
import { useMemo } from "react"
import { fixtureTablesOf } from "@/modules/workbench-fixtures"
import type { FixtureTables } from "@/modules/workbench-host"

/** The tables of the fixtures of every module in the viewer's language, joined once per language; Vietnamese is the default. */
export const useFixtureTables = (): FixtureTables => {
    const locale = useLocale() === "en" ? "en" : "vi"
    return useMemo(() => fixtureTablesOf(MODULE_FIXTURES, locale), [locale])
}
