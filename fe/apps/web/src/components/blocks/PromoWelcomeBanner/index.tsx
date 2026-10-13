"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { navigation } from "@/modules/i18n"
import { agentChatHref } from "@/modules/routes"
import { PromoWelcomeBannerBase } from "./component"

/** Props of {@link PromoWelcomeBanner}. */
export interface PromoWelcomeBannerProps {
    /** The chatbot agent the band sends the member to test. */
    readonly agentId: string
}

/** The connected welcome band: dismissible, and closing it drops the welcome flag from the address. */
export const PromoWelcomeBanner = (props: PromoWelcomeBannerProps) => {
    const router = navigation.useRouter()
    const t = useTranslations("promoAds")
    const [open, setOpen] = useState(true)
    if (!open) return null
    const close = () => {
        setOpen(false)
        router.replace(agentChatHref(props.agentId), { scroll: false })
    }
    return (
        <PromoWelcomeBannerBase
            props={{
                ariaLabel: t("welcomeAria"),
                title: t("welcomeTitle"),
                text: t("welcomeText"),
                closeLabel: t("welcomeClose"),
                testLabel: t("welcomeTest"),
                testHref: agentChatHref(props.agentId, "customer"),
                officeLabel: t("welcomeOffice"),
                officeHref: "/chat",
            }}
            on={{ close }}
        />
    )
}
