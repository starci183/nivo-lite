import { getTranslations } from "next-intl/server"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { LandingConnectBase } from "./component"

/** The channels listed: catalog keys and whether the channel works today. */
const CHANNELS = [
    { id: "website", name: "chWebsite", text: "chWebsiteText", isLive: true },
    { id: "zalo", name: "chZalo", text: "chZaloText", isLive: false },
    { id: "email", name: "chEmail", text: "chEmailText", isLive: false },
    { id: "form", name: "chForm", text: "chFormText", isLive: false },
] as const

/** The landing connect section with its copy resolved on the server. */
export const LandingConnect = async () => {
    const t = await getTranslations("landing")
    return (
        <LandingConnectBase
            props={{
                headingId: "landing-connect",
                eyebrow: t("connectEyebrow"),
                title: t("connectTitle"),
                lead: t("connectLead"),
                ctaLabel: t("connectCta"),
                ctaHref: CONSOLE_ROUTES.login,
                liveLabel: t("connectAvailable"),
                roadmapLabel: t("connectRoadmap"),
                note: t("connectNote"),
                channels: CHANNELS.map((channel) => ({
                    id: channel.id,
                    name: t(channel.name),
                    text: t(channel.text),
                    isLive: channel.isLive,
                })),
            }}
        />
    )
}
