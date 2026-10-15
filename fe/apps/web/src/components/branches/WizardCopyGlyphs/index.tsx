import { Icon } from "@starci/grammar/common"
import { nivoIconSource, type IconName } from "@/components/leaves/Icon"

/** A NIVO glyph in the shape Grammar's in-field actions take; decorative (the action keeps its label), sized by Grammar's own icon box. */
const glyph = (name: IconName) => {
    const Glyph = () => <Icon source={nivoIconSource(name, "leading")} usage="leading" />
    Glyph.displayName = `Glyph(${name})`
    return Glyph
}

/** The four in-field actions of a copyable value: copy, copied, show a secret, hide it. */
export const WizardCopyGlyphs = {
    copy: glyph("copy"),
    copied: glyph("copied"),
    reveal: glyph("revealPassword"),
    hide: glyph("hidePassword"),
} as const
