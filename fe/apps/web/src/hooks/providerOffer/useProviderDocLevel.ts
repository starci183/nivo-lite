"use client"

import { useLocale, useTranslations } from "next-intl"
import { useParams } from "next/navigation"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryProviderOfferSwr } from "@/hooks/swr"
import type { ProviderDocLevelView, ProviderDocWords } from "@/modules/types"
import { apiEntriesOf, mcpEntriesOf, triggerEntriesOf, type ProviderOfferWords } from "./providerOffer.shared"

/** One documented level of a provider: the reads screens call, the tools agents call, the triggers that wake workflows. */
export type ProviderDocLevel = "api" | "mcp" | "trigger"

/** What a docs tab block draws: its level (lead, empty line, entries slot), the shared table words, and the retry of the read. */
export interface ProviderDocLevelRead {
    readonly level: ProviderDocLevelView
    readonly words: ProviderDocWords
    readonly retry: () => void
}

const ENTRIES_OF = { api: apiEntriesOf, mcp: mcpEntriesOf, trigger: triggerEntriesOf } as const

/** The resolved catalog words the mappers of the three docs levels need, in the reader's language. */
export const useProviderOfferWords = (): ProviderOfferWords => {
    const t = useTranslations("providerPage")
    return {
        kinds: { read: t("kindRead"), write: t("kindWrite"), webhook: t("kindWebhook"), poll: t("kindPoll") },
        groupParameters: t("groupParameters"),
        groupReturnsRow: t("groupReturnsRow"),
        groupReturns: t("groupReturns"),
        groupPayload: t("groupPayload"),
        freshness: { live: t("freshnessLive"), synced: t("freshnessSynced") },
        batchingEach: t("batchingEach"),
        batchingList: (maxEvents) => t("batchingList", { maxEvents }),
        batchingListOpen: t("batchingListOpen"),
        recoveryYes: t("recoveryYes"),
        recoveryNo: t("recoveryNo"),
        types: {
            string: t("typeString"),
            integer: t("typeInteger"),
            number: t("typeNumber"),
            boolean: t("typeBoolean"),
            object: t("typeObject"),
            array: t("typeArray"),
            null: t("typeNull"),
            id: t("typeId"),
            choice: t("typeChoice"),
        },
        formats: {
            uuid: t("formatUuid"),
            "date-time": t("formatDateTime"),
            date: t("formatDate"),
            time: t("formatTime"),
            uri: t("formatUri"),
            email: t("formatEmail"),
        },
        typeArrayOf: (item) => t("typeArrayOf", { item }),
        effects: { money: t("effectMoney"), irreversible: t("effectIrreversible") },
        states: {
            missing: t("stateMissing"),
            unsupported: t("stateUnsupported"),
            mode_mismatch: t("stateModeMismatch"),
        },
        filterable: t("filterable"),
    }
}

/**
 * One level of the provider page's docs for the account the address names (`/connections/open/<id>/<level>`), from the
 * `providerOffer` query: documentation from the registries, never a live provider call. The three docs tabs share one read.
 */
export const useProviderDocLevel = (levelId: ProviderDocLevel): ProviderDocLevelRead => {
    const t = useTranslations("providerPage")
    const locale = useLocale()
    const params = useParams<{ id?: string }>()
    const read = useQueryProviderOfferSwr(typeof params.id === "string" ? params.id : null)
    const words = useProviderOfferWords()
    const leads = { api: t("apiLead"), mcp: t("mcpLead"), trigger: t("triggerLead") }
    const empties = { api: t("apiEmpty"), mcp: t("mcpEmpty"), trigger: t("triggerEmpty") }
    return {
        level: {
            lead: leads[levelId],
            empty: empties[levelId],
            entries: mapSlot(slotOfSwr(read), (offer) => ENTRIES_OF[levelId](offer, words, locale)),
        },
        words: {
            columnName: t("columnName"),
            columnType: t("columnType"),
            columnMeaning: t("columnMeaning"),
            membersEmpty: t("membersEmpty"),
        },
        retry: () => void read.mutate(),
    }
}
