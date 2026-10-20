"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { uploadedFileOf } from "@/hooks/csv-import-wizard"
import {
    useMutateDecideBrandProposalSwr,
    useMutateProposeBrandKitSwr,
    useQueryBrandProposalsSwr,
    type BrandProposalType,
} from "@/hooks/swr"
import type { BrandKitDraft } from "@/modules/content"
import { toast, useGraphQLWithToast } from "@/modules/toast"

/** The largest guideline the back end reads: twenty megabytes. */
const GUIDELINE_MAX_BYTES = 20 * 1024 * 1024

/** Where the guideline joins: the instance, its open setup draft, and whether this agent reads guidelines at all. */
interface SetupBrandKitScope {
    readonly installationId: string
    readonly setupSessionId: string
    readonly isEnabled: boolean
    /** Re-reads the setup chat, where the back end posts the "[PDF]" line and the answer of NIVO. */
    readonly onRead: () => void
}

const NO_PROPOSALS: ReadonlyArray<BrandProposalType> = []

const kitInputOf = (kit: BrandKitDraft) => ({
    ...kit,
    colors: kit.colors.map((color) => ({ ...color })),
    fonts: [...kit.fonts],
    imagery: [...kit.imagery],
    avoid: [...kit.avoid],
})

/** The brand guideline flow of the setup chat: attach a PDF, read its brand proposal, confirm (edited) or reject it. */
export const useSetupBrandKit = (scope: SetupBrandKitScope) => {
    const t = useTranslations("marketing")
    const tToast = useTranslations("toast")
    const runGraphQL = useGraphQLWithToast()
    const list = useQueryBrandProposalsSwr(scope.isEnabled && scope.installationId !== "" ? scope.installationId : null)
    const propose = useMutateProposeBrandKitSwr()
    const decision = useMutateDecideBrandProposalSwr()
    const [decidingId, setDecidingId] = useState("")
    const attach = async (files: ReadonlyArray<File>) => {
        const file = files[0]
        if (file === undefined) return
        if (!file.name.toLowerCase().endsWith(".pdf") || file.size > GUIDELINE_MAX_BYTES) {
            toast.danger(tToast("errorTitle"), { description: t("guidelineInvalid") })
            return
        }
        const read = await runGraphQL(
            async () =>
                propose.trigger({
                    installationId: scope.installationId,
                    setupSessionId: scope.setupSessionId,
                    file: await uploadedFileOf(file),
                }),
            { successMessage: t("guidelineRead", { name: file.name }) },
        )
        if (read === undefined) return
        scope.onRead()
        await list.mutate()
    }
    const decide = async (proposalId: string, choice: "confirm" | "reject", kit?: BrandKitDraft) => {
        setDecidingId(proposalId)
        const decided = await runGraphQL(
            () =>
                decision.trigger({
                    proposalId,
                    decision: choice,
                    kit: kit === undefined ? undefined : kitInputOf(kit),
                }),
            { successMessage: choice === "confirm" ? t("brandApplied") : t("brandRejected") },
        )
        setDecidingId("")
        if (decided !== undefined) await list.mutate()
        return decided !== undefined
    }
    return {
        proposals: list.data ?? NO_PROPOSALS,
        isReading: propose.isMutating,
        decidingId,
        attach,
        decide,
    }
}
