import {
    ArrowRightEndOnRectangleIcon,
    Bars3Icon,
    GlobeAltIcon,
    LanguageIcon,
    MoonIcon,
    SunIcon,
} from "@heroicons/react/24/outline"
import type { IconUsage } from "@starci/grammar/common"
import type { SVGProps } from "react"

/** Every source in this registry is callable (Heroicons are forward-ref callables). */
type GlyphComponent = (props: SVGProps<SVGSVGElement>) => unknown

/** The meanings the platform-admin bar draws. */
type IconName = "explore" | "locale" | "light" | "dark" | "signOut" | "menu"

/** The app answer to "which glyph means this": outline cuts only. */
const ICON_SOURCES: Readonly<Record<IconName, GlyphComponent>> = {
    explore: GlobeAltIcon,
    locale: LanguageIcon,
    light: SunIcon,
    dark: MoonIcon,
    signOut: ArrowRightEndOnRectangleIcon,
    menu: Bars3Icon,
}

/** Resolves an app-owned semantic icon name to the glyph Grammar's Icon asks for (every usage draws the outline). */
export const adminIconSource = (name: IconName, _usage: IconUsage = "chip"): GlyphComponent => ICON_SOURCES[name]
