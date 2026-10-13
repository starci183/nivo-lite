import { useTranslations } from "next-intl"
import { WizardCopyGlyphs } from "@/components/leaves/WizardCopyGlyphs"

/**
 * The Grammar Input props that make a value copyable in place and, for a secret, revealable. Kept at this path for the developers
 * page and the provider wizards that have not moved yet; the new surfaces use ConnectionCopyInput.
 */
export const useCopyField = () => {
    const t = useTranslations("connections")
    return {
        isCopyable: true,
        copyLabel: t("copy"),
        copiedLabel: t("copied"),
        copyIcon: WizardCopyGlyphs.copy,
        copiedIcon: WizardCopyGlyphs.copied,
        revealLabel: t("reveal"),
        hideLabel: t("hide"),
        revealIcon: WizardCopyGlyphs.reveal,
        hideIcon: WizardCopyGlyphs.hide,
    } as const
}
