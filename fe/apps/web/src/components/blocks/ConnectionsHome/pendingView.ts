import type { useFormatter, useTranslations } from "next-intl"
import { providerLogoOf, providerNameOf, type useProviderTemplateCandidates } from "@/hooks/providerRights"
import type { PendingAttachmentView } from "./types"

/** The pending providers as the rows of "needs you" draw them, every word resolved (the agents joined by the reader's language). */
export const pendingViewsOf = (
    t: ReturnType<typeof useTranslations<"agentRights">>,
    format: ReturnType<typeof useFormatter>,
    rows: ReturnType<typeof useProviderTemplateCandidates>["rows"],
): ReadonlyArray<PendingAttachmentView> =>
    rows.map((row) => {
        const provider = providerNameOf(row.provider)
        const agents = format.list(
            row.candidates.map((candidate) => candidate.agentName),
            { type: "conjunction" },
        )
        return {
            id: row.provider,
            title: t("pendingTitle", { provider, agents }),
            body: t("pendingBody", { provider }),
            name: provider,
            logo: providerLogoOf(row.provider),
            laterLabel: t("pendingLater"),
            attachLabel: t("pendingAttach"),
        }
    })
