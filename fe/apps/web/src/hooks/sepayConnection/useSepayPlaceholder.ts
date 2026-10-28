"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import type { SepayConnectionView } from "@/modules/types"
import { sepayPlaceholderOf } from "./sepayConnection.shared"

/** The skeleton connection, worded from the catalog. */
export const useSepayPlaceholder = (): SepayConnectionView => {
    const t = useTranslations("sepayConnection")
    return useMemo(
        () => sepayPlaceholderOf({ name: t("title"), bank: t("placeholderBank"), holder: t("placeholderHolder") }),
        [t],
    )
}
