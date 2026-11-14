"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useCrmPin } from "@/hooks/crm-pin"
import { shortShaOf, crmStateToneOf } from "@/modules/crm"
import { CrmApiTabBase } from "./component"

/** What the page hands the tab: the account of the address. */
interface CrmApiTabProps {
    readonly connectionId: string
}

/** The API tab of a CRM connected by Swagger: the operations the pinned snapshot serves, read only, and the command that pins it again. */
export const CrmApiTab = (props: CrmApiTabProps) => {
    const t = useTranslations("connectorCrm")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const read = useCrmPin(props.connectionId)
    return (
        <CrmApiTabBase
            props={{
                slot: read.slot,
                slotLabels: slotLabels(t("apiEmpty")),
                isPending: read.isPending,
                error: read.error,
                text: {
                    lead: t("apiLead"),
                    neededTitle: t("apiNeededTitle"),
                    othersTitle: t("apiOthersTitle"),
                    empty: t("apiEmpty"),
                    snapshotTitle: t("snapshotTitle"),
                    snapshotNone: t("snapshotNone"),
                    repin: t("repin"),
                    repinHint: t("repinHint"),
                    factCrmId: t("factCrmId"),
                    factBaseUrl: t("fieldBaseUrl"),
                    factSwagger: t("factSwagger"),
                    factSha: t("factSha"),
                    factPinnedAt: t("factPinnedAt"),
                },
                stateLabel: (state) => t(`state_${state}`),
                stateTone: crmStateToneOf,
                shortSha: shortShaOf,
                pinnedAtLabel: (iso) => format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short" }),
            }}
            on={{ repin: read.repin, retry: read.retry }}
        />
    )
}
