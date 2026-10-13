"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useFoundingMember } from "@/hooks/promo"
import { navigation } from "@/modules/i18n"
import { agentChatHref } from "@/modules/routes"
import { PromoWelcomeBannerBase } from "./component"

/** Props of {@link PromoWelcomeBanner}. */
interface PromoWelcomeBannerProps {
    /** The chatbot agent the band sends the member to test. */
    readonly agentId: string
}

/** The connected welcome band for a founding member: dismissible, and closing it drops the welcome flag from the address. */
export const PromoWelcomeBanner = (props: PromoWelcomeBannerProps) => {
    const router = navigation.useRouter()
    const t = useTranslations("promoAds")
    const [open, setOpen] = useState(true)
    const founding = useFoundingMember(true)
    if (!open || founding.data !== true) return null
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
