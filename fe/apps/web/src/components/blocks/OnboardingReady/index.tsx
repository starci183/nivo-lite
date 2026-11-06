"use client"

import { useTranslations } from "next-intl"
import { useWorkspaceCards, useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, workspaceHref } from "@/modules/routes"
import { OnboardingReadyBase } from "./component"

/** The connected ready screen: names the workspace just made (the one the address carries) and lands on the Office. */
export const OnboardingReady = () => {
    const t = useTranslations("onboarding")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const { cards, status } = useWorkspaceCards()
    const name = cards.find((card) => card.id === workspaceId)?.name
    return (
        <OnboardingReadyBase
            props={{
                title: t("readyTitle"),
                heading: name === undefined ? t("readyTitle") : t("readyHeading", { name }),
                description: t("readyText"),
                enterLabel: t("enterWorkspace"),
                isLoading: status === "loading",
            }}
            on={{
                enter: () => {
                    router.push(workspaceHref(workspaceId, APP_ROUTES.workspaceHome))
                },
            }}
        />
    )
}
