"use client"

import { useTranslations } from "next-intl"
import { isManager, useMember } from "@/hooks/member"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useQueryWorkspaceThemeSwr } from "@/hooks/swr"
import { THEME_FONTS, THEME_RADII, useThemeDraft } from "@/hooks/workspaceTheme"
import { ThemeSettingsBase } from "./component"
import { previewCopyOf, themeNamesOf } from "./copy"

/**
 * The connected theme tab: the draft starts from the saved theme (or the NIVO default), every control changes the draft and the preview
 * paints it at once; Save writes it, "back to NIVO default" removes the saved theme. A member who is not owner or manager sees the preview
 * and changes nothing.
 */
export const ThemeSettings = () => {
    const t = useTranslations("settings")
    const member = useMember()
    const slotLabels = useSlotLabels()
    const read = useQueryWorkspaceThemeSwr()
    const theme = useThemeDraft()
    const names = themeNamesOf(t)

    return (
        <ThemeSettingsBase
            props={{
                brandTitle: t("themeBrandTitle"),
                resetLabel: t("themeReset"),
                accent: {
                    label: t("themeAccentLabel"),
                    hint: t("themeAccentHint"),
                    hueLabel: t("themeHueLabel"),
                    swatchLabel: t("themeSwatchLabel"),
                    areaLabel: t("themeAreaLabel"),
                    hexLabel: t("themeHexLabel"),
                    hex: theme.accentHex,
                },
                base: { label: t("themeBaseLabel"), hint: t("themeBaseHint"), value: theme.draft.base },
                font: {
                    label: t("themeFontLabel"),
                    placeholder: t("themeFontPlaceholder"),
                    value: theme.draft.font,
                    options: THEME_FONTS.map((font) => ({ id: font, label: names.fonts[font] })),
                },
                radius: {
                    label: t("themeRadiusLabel"),
                    empty: t("themeRadiusEmpty"),
                    value: theme.draft.radius,
                    options: THEME_RADII.map((radius) => ({ id: radius, label: names.radii[radius] })),
                },
                contrastNote: t("themeContrastNote"),
                saveLabel: t("themeSave"),
                isPending: theme.isPending,
                canEdit: isManager(member),
                readOnlyNote: t("readOnlyNote"),
                preview: {
                    ...previewCopyOf(t),
                    mode: theme.mode,
                    scopeClass: theme.scopeClass,
                    scopeCss: theme.scopeCss,
                },
                slot: mapSlot(slotOfSwr(read), () => true as const),
                labels: slotLabels(t("loadFailed")),
            }}
            on={{
                setAccentHex: theme.setAccentHex,
                setBase: theme.setBase,
                setFont: theme.setFont,
                setRadius: theme.setRadius,
                setMode: theme.setMode,
                reset: theme.reset,
                save: theme.save,
                retry: () => void read.mutate(),
            }}
        />
    )
}
