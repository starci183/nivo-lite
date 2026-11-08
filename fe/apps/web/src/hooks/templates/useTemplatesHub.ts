"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { slotOfSwr } from "@/hooks/slot"
import type { DataSlot } from "@/modules/types"
import {
    useMutateAcceptTemplateUpdateSwr,
    useMutateImportAgentTemplateSwr,
    useMutateSubmitTemplateListingSwr,
    useQueryMyAgentTemplatesSwr,
    useQueryTemplateUpdateOffersSwr,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import {
    acceptInputOf,
    safeUnitIds,
    valuesOfText,
    type MyAgentTemplatesData,
    type TemplateUpdateOffersData,
} from "./templates.shared"

/** What the hub of templates reads and does. */
export interface TemplatesHubController {
    /** The templates of the caller. */
    readonly slot: DataSlot<MyAgentTemplatesData>
    /** The newer versions offered. */
    readonly offerSlot: DataSlot<TemplateUpdateOffersData>
    /** Reads the templates again. */
    readonly reload: () => void
    /** The values the buyer wrote, as JSON text. */
    readonly valuesText: string
    /** Writes the values. */
    readonly setValuesText: (value: string) => void
    /** The price the creator wrote. */
    readonly price: string
    /** Writes the price. */
    readonly setPrice: (value: string) => void
    /** What went wrong before a command was sent, or undefined. */
    readonly notice: string | undefined
    /** True while a command runs. */
    readonly isPending: boolean
    /** Installs a version in this workspace. */
    readonly importVersion: (templateKey: string, version: number) => Promise<void>
    /** Offers a version on the marketplace. */
    readonly submitVersion: (templateKey: string, version: number) => Promise<void>
    /** Takes units of an update. */
    readonly accept: (installationId: string, unitIds: Array<string>) => Promise<void>
    /** The ids of an offer that are safe to take at once. */
    readonly safeUnitIds: typeof safeUnitIds
}

/** The hub of the templates of the caller: their versions, the install of one in this workspace, the listing of one, and the updates offered. */
export const useTemplatesHub = (): TemplatesHubController => {
    const t = useTranslations("agentTemplates")
    const run = useGraphQLWithToast()
    const templates = useQueryMyAgentTemplatesSwr()
    const offers = useQueryTemplateUpdateOffersSwr()
    const importer = useMutateImportAgentTemplateSwr()
    const submitter = useMutateSubmitTemplateListingSwr()
    const accepter = useMutateAcceptTemplateUpdateSwr()
    const [valuesText, setValuesText] = useState("")
    const [price, setPrice] = useState("0")
    const [notice, setNotice] = useState<string | undefined>(undefined)
    const slot = slotOfSwr({ data: templates.data, error: templates.error, isLoading: templates.isLoading })
    const offerSlot = slotOfSwr({ data: offers.data, error: offers.error, isLoading: offers.isLoading })
    const importVersion = async (templateKey: string, version: number) => {
        const values = valuesOfText(valuesText)
        if (values === null) {
            setNotice(t("valuesInvalid"))
            return
        }
        const made = await run(() => importer.trigger({ templateKey, version, values }), {
            successMessage: t("imported"),
        })
        if (made !== undefined) setNotice(undefined)
        void offers.mutate()
    }
    const submitVersion = async (templateKey: string, version: number) => {
        const priceVnd = Math.round(Number(price))
        if (!Number.isFinite(priceVnd) || priceVnd < 0) {
            setNotice(t("priceInvalid"))
            return
        }
        const listing = await run(() => submitter.trigger({ templateKey, version, priceVnd }), {
            successMessage: t("submitted"),
        })
        setNotice(listing === undefined ? undefined : t(`listing_${listing.status}`))
    }
    const accept = async (installationId: string, unitIds: Array<string>) => {
        await run(() => accepter.trigger(acceptInputOf(installationId, unitIds)), { successMessage: t("accepted") })
        void offers.mutate()
    }
    return {
        slot,
        offerSlot,
        reload: () => void templates.mutate(),
        valuesText,
        setValuesText,
        price,
        setPrice,
        notice,
        isPending: importer.isMutating || submitter.isMutating || accepter.isMutating,
        importVersion,
        submitVersion,
        accept,
        safeUnitIds,
    }
}
