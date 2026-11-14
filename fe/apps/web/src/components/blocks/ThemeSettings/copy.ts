import type { useTranslations } from "next-intl"
import type { ThemeSettingsBaseProps } from "./component"

/** The translator of the settings catalog. */
type Translate = ReturnType<typeof useTranslations<"settings">>

/** The names of the fonts and the corner steps the selects list, by key (brand names for the fonts; words for the corners). */
interface ThemeNames {
    readonly fonts: Readonly<
        Record<"inter" | "be-vietnam-pro" | "ibm-plex-sans" | "lexend" | "nunito" | "roboto", string>
    >
    readonly radii: Readonly<Record<"square" | "small" | "medium" | "large", string>>
}

/** The names of the fonts and the corner steps the selects list, by key. */
export const themeNamesOf = (t: Translate): ThemeNames => ({
    fonts: {
        inter: t("themeFontInter"),
        "be-vietnam-pro": t("themeFontBeVietnamPro"),
        "ibm-plex-sans": t("themeFontIbmPlexSans"),
        lexend: t("themeFontLexend"),
        nunito: t("themeFontNunito"),
        roboto: t("themeFontRoboto"),
    },
    radii: {
        square: t("themeRadiusSquare"),
        small: t("themeRadiusSmall"),
        medium: t("themeRadiusMedium"),
        large: t("themeRadiusLarge"),
    },
})

/** The static words of the preview sample and its switch. */
export const previewCopyOf = (t: Translate): Pick<
    ThemeSettingsBaseProps["props"]["preview"],
    "title" | "modeLabel" | "modeItems" | "rowTitle" | "rowText" | "badge" | "primary" | "secondary" | "botLine" | "customerLine"
> => ({
    title: t("themePreviewTitle"),
    modeLabel: t("themeModeLabel"),
    modeItems: [
        { id: "light", label: t("themeModeLight") },
        { id: "dark", label: t("themeModeDark") },
    ],
    rowTitle: t("themePreviewRowTitle"),
    rowText: t("themePreviewRowText"),
    badge: t("themePreviewBadge"),
    primary: t("themePreviewPrimary"),
    secondary: t("themePreviewSecondary"),
    botLine: t("themePreviewBotLine"),
    customerLine: t("themePreviewCustomerLine"),
})
