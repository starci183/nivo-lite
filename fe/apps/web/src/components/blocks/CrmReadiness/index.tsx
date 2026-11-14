"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useCrmPin } from "@/hooks/crm-pin"
import { crmReadinessOf, crmStateToneOf } from "@/modules/crm"
import { CrmReadinessBase } from "./component"

/** What the page hands the card: the account of the address. */
interface CrmReadinessProps {
    readonly connectionId: string
}

/** The compatibility of a CRM connection with the installed packages, on its Config tab. */
export const CrmReadiness = (props: CrmReadinessProps) => {
    const t = useTranslations("connectorCrm")
    const slotLabels = useSlotLabels()
    const read = useCrmPin(props.connectionId)
    return (
        <CrmReadinessBase
            props={{
                slot: read.slot,
                slotLabels: slotLabels(""),
                text: {
                    title: t("readinessTitle"),
                    factCrmId: t("factCrmId"),
                    factNeeded: t("readinessNeeded"),
                    missingTitle: t("resultMissingTitle"),
                    missingEmpty: t("resultMissingEmpty"),
                    noPin: t("snapshotNone"),
                },
                readyLabel: (view) => {
                    const readiness = crmReadinessOf(view.pin)
                    return readiness.needed === 0
                        ? t("readinessNoNeeds")
                        : t("readinessCount", { ready: readiness.ready, needed: readiness.needed })
                },
                stateLabel: (state) => t(`state_${state}`),
                stateTone: crmStateToneOf,
            }}
            on={{ retry: read.retry }}
        />
    )
}
