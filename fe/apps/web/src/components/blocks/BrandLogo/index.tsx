"use client"

import { useTranslations } from "next-intl"
import { BrandLogoBase } from "./component"

/** What a screen chooses about the logo. */
type BrandLogoProps = {
    readonly variant?: "full" | "os" | "mark"
    readonly height?: number
}

/** The NIVO logo with its spoken name read from the catalog. */
export const BrandLogo = (props: BrandLogoProps) => {
    const t = useTranslations("common")
    const label = props.variant === "os" || props.variant === undefined ? t("brandLogoOs") : t("brandLogo")
    return <BrandLogoBase props={{ variant: props.variant, height: props.height, label }} />
}
