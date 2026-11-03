import type { ReactElement } from "react"
import { Icon } from "@starci/grammar/common"
import { nivoIconSource, type IconName } from "@/components/leaves/Icon"

/** A glyph component named for the dev tools. */
interface WizardGlyph {
    (): ReactElement
    displayName: string
}

/** The four glyphs of a copyable value. */
interface WizardCopyGlyphSet {
    readonly copy: WizardGlyph
    readonly copied: WizardGlyph
    readonly reveal: WizardGlyph
    readonly hide: WizardGlyph
}

/** A NIVO glyph in the shape Grammar's in-field actions take; decorative (the action keeps its label), sized by Grammar's own icon box. */
const glyph = (name: IconName): WizardGlyph => {
    const Glyph = (): ReactElement => <Icon source={nivoIconSource(name, "leading")} usage="leading" />
    Glyph.displayName = `Glyph(${name})`
    return Glyph
}

/** The four in-field actions of a copyable value: copy, copied, show a secret, hide it. */
export const WizardCopyGlyphs: WizardCopyGlyphSet = {
    copy: glyph("copy"),
    copied: glyph("copied"),
    reveal: glyph("revealPassword"),
    hide: glyph("hidePassword"),
}
