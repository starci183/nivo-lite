"use client"

import { useTranslations } from "next-intl"
import { LANDING_ROUTES } from "@/modules/routes"
import { LandingNavBrandBase } from "./component"

/** The approved NIVO logo raster. */
const LOGO_SRC = "/brand/nivo-logo.png"

/** The logo link of the top bar, with its copy resolved. */
export const LandingNavBrand = () => {
    const t = useTranslations("landing")
    return (
        <LandingNavBrandBase props={{ homeHref: LANDING_ROUTES.home, homeLabel: t("homeLabel"), logoSrc: LOGO_SRC }} />
    )
}
