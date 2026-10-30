"use client"

import { useTranslations } from "next-intl"
import { useActiveWorkspace, useWorkspaceCards } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES } from "@/modules/routes"
import { OnboardingReadyBase } from "./component"

/** The connected ready screen: names the workspace just made (the active one) and lands on the Office. */
export const OnboardingReady = () => {
    const t = useTranslations("onboarding")
    const router = navigation.useRouter()
    const { activeWorkspaceId } = useActiveWorkspace()
    const { cards, status } = useWorkspaceCards()
    const name = cards.find((card) => card.id === activeWorkspaceId)?.name
    return (
        <OnboardingReadyBase
            props={{
                title: t("readyTitle"),
                heading: name === undefined ? t("readyTitle") : t("readyHeading", { name }),
                description: t("readyText"),
                enterLabel: t("enterWorkspace"),
                isSkeleton: status === "loading",
            }}
            on={{
                enter: () => {
                    router.push(APP_ROUTES.chat)
                    router.refresh()
                },
            }}
        />
    )
}
