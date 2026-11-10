import type { useFormatter, useTranslations } from "next-intl"
import { accountTitleOf, pickLabel, providerLogoOf, type useProviderTemplateCandidates } from "@/hooks/providerRights"
import type { PendingAttachmentView } from "./types"

/** The pending accounts as the rows of "needs you" draw them, every word resolved (the agents joined by the reader's language). */
export const pendingViewsOf = (
    t: ReturnType<typeof useTranslations<"agentRights">>,
    format: ReturnType<typeof useFormatter>,
    locale: string,
    rows: ReturnType<typeof useProviderTemplateCandidates>["rows"],
): ReadonlyArray<PendingAttachmentView> =>
    rows.map((row) => {
        const provider = pickLabel(row.provider.label, locale)
        const agents = format.list(
            row.candidates.map((candidate) => candidate.agentName),
            { type: "conjunction" },
        )
        return {
            id: row.account.connectionId,
            title: t("pendingTitle", { account: accountTitleOf(provider, row.account.accountLabel), agents }),
            body: t("pendingBody"),
            name: provider,
            logo: providerLogoOf(row.provider.provider),
            laterLabel: t("pendingLater"),
            attachLabel: t("pendingAttach"),
        }
    })
