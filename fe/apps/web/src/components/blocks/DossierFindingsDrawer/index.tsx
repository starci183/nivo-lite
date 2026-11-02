"use client"

import { useTranslations } from "next-intl"
import { useDossierFindingsView } from "@/hooks/brain"
import { navigation } from "@/modules/i18n"
import { brainTabHref } from "@/modules/routes"
import { DossierFindingsDrawerBase } from "./component"

/** The selected dossier and finding, mounted by the feature only while its original drawer is open. */
interface DossierFindingsDrawerProps {
    readonly dossierId: string
    readonly findingId: string | undefined
}

/** Owns the selected dossier's findings, its drawer copy and URL close action. */
export const DossierFindingsDrawer = (props: DossierFindingsDrawerProps) => {
    const t = useTranslations("dossierReview")
    const router = navigation.useRouter()
    const view = useDossierFindingsView({ kind: "dossier", dossierId: props.dossierId, findingId: props.findingId })
    return (
        <DossierFindingsDrawerBase
            props={{ ...view.props, drawerTitle: t("detailLabel"), closeLabel: t("detailClose") }}
            on={{ ...view.on, close: () => router.replace(brainTabHref("dossiers")) }}
        />
    )
}
