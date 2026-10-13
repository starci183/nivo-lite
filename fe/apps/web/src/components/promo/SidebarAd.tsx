"use client"

import { useEffect, useState } from "react"
import { Badge, Button, CloseButton, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { promo } from "@/i18n/dict/promo"
import { isOfferLive } from "@/lib/promo"
import * as c from "./cardClassNames"

const STORAGE_KEY = "nivo.promo.sidebar-ad.dismissed"

export type SidebarAdProps = {
    readonly hasChatbot: boolean
    readonly isFoundingMember: boolean
    readonly ctaHref?: string
}

/**
 * Compact sidebar card. Before the Chatbot is bought it is a dismissible Founding 50 ad; afterwards a quiet
 * "Founding member" card (only claiming the locked price when the purchase really happened inside the offer window).
 * Both are Grammar `SurfaceCard`s nested in the navigation surface (BOUNDARY-5 case-1). The ad no longer paints an
 * ink gradient or a mascot: the sidebar is chrome, where the mascot is forbidden, and the page's own decision keeps
 * the one primary action (ACCENT-1), so the ad's action is `secondary`.
 */
export const SidebarAd = ({
    hasChatbot,
    isFoundingMember,
    ctaHref = "/modules/new?module=chatbot",
}: SidebarAdProps) => {
    const t = useT(promo)
    const [dismissed, setDismissed] = useState(false)
    useEffect(() => {
        try {
            setDismissed(window.localStorage.getItem(STORAGE_KEY) === "1")
        } catch {
            /* storage unavailable: keep showing */
        }
    }, [])

    if (hasChatbot) {
        if (!isFoundingMember) return null
        return (
            <div role="note" aria-label={t("foundingMember")}>
                <SurfaceCard depth="nested">
                    <div className={c.STACK}>
                        <Badge tone="accent" isDot>
                            {t("foundingMember")}
                        </Badge>
                        <Text size="xs">{t("priceLocked")}</Text>
                    </div>
                </SurfaceCard>
            </div>
        )
    }
    if (dismissed || !isOfferLive()) return null

    const dismiss = () => {
        setDismissed(true)
        try {
            window.localStorage.setItem(STORAGE_KEY, "1")
        } catch {
            /* ignore */
        }
    }

    return (
        <aside aria-label={t("adAria")}>
            <SurfaceCard depth="nested">
                <div className={c.STACK}>
                    <div className={c.AD_HEAD}>
                        <Text size="sm" weight="semibold">
                            {t("adTitle")}
                        </Text>
                        <CloseButton label={t("adDismiss")} size="sm" onPress={dismiss} />
                    </div>
                    <Text size="xs">{t("adText")}</Text>
                    <Badge tone="accent">{t("adOff")}</Badge>
                    <Button variant="secondary" size="sm" href={ctaHref}>
                        {t("addChatbot")}
                    </Button>
                </div>
            </SurfaceCard>
        </aside>
    )
}
