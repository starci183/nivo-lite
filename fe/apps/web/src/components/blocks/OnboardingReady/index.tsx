"use client"

import { useTranslations } from "next-intl"
import { nivoIconSource } from "@/components/leaves/Icon"
import { useWorkspaceCards, useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { OnboardingReadyBase } from "./component"

/** The connected ready screen: names the workspace just made (the one the address carries), offers the first steps, lands on the workspace home. */
export const OnboardingReady = () => {
    const t = useTranslations("onboarding")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const { cards, slot } = useWorkspaceCards()
    const name = cards.find((card) => card.id === workspaceId)?.name
    const open = (path: string) => workspaceHref(workspaceId, path)
    return (
        <OnboardingReadyBase
            props={{
                badge: t("readyBadge"),
                heading: name === undefined ? t("readyTitle") : t("readyHeading", { name }),
                description: t("readyText"),
                nextLabel: t("readyNextLabel"),
                next: [
                    {
                        id: "connections",
                        title: t("readyNextChannels"),
                        description: t("readyNextChannelsText"),
                        leading: { icon: nivoIconSource("link", "leading") },
                        href: open(CONSOLE_ROUTES.connections),
                    },
                    {
                        id: "team",
                        title: t("readyNextTeam"),
                        description: t("readyNextTeamText"),
                        leading: { icon: nivoIconSource("community", "leading") },
                        href: open(CONSOLE_ROUTES.teamInvite),
                    },
                ],
                enterLabel: t("enterWorkspace"),
                isLoading: "isLoading" in slot,
            }}
            on={{
                enter: () => {
                    router.push(workspaceHref(workspaceId, APP_ROUTES.workspaceHome))
                },
            }}
        />
    )
}
