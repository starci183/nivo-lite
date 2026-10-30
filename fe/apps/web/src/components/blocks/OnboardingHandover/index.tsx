"use client"

import { useTranslations } from "next-intl"
import { APP_ROUTES } from "@/modules/routes"
import { OnboardingHandoverBase } from "./component"

/** The connected handover step: the two rules every new workspace starts with (the owner holds new customers, the AI asks before it sends). */
export const OnboardingHandover = () => {
    const t = useTranslations("onboarding")
    return (
        <OnboardingHandoverBase
            props={{
                title: t("handoverTitle"),
                heading: t("handoverQuestion"),
                description: t("handoverText"),
                rules: [
                    { id: "owner", name: t("ruleOwner"), description: t("ruleOwnerText"), value: t("ruleOwnerValue") },
                    {
                        id: "approval",
                        name: t("ruleApproval"),
                        description: t("ruleApprovalText"),
                        value: t("ruleApprovalValue"),
                    },
                ],
                backLabel: t("back"),
                backHref: APP_ROUTES.workspaceChannels,
                finishLabel: t("finish"),
                finishHref: APP_ROUTES.workspaceReady,
            }}
        />
    )
}
