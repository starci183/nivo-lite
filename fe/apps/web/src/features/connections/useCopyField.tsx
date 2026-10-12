"use client"

import { Icon } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { nivoIconSource, type IconName } from "@/ui"

/** A NIVO glyph in the shape Grammar's in-field actions take (`{ className }`); decorative, the action keeps its label. */
const glyph = (name: IconName) => {
  const Glyph = ({ className }: { readonly className?: string }) => (
    <span className={className}><Icon source={nivoIconSource(name, "leading")} usage="leading" /></span>
  )
  Glyph.displayName = `Glyph(${name})`
  return Glyph
}
const COPY = glyph("copy")
const COPIED = glyph("copied")
const REVEAL = glyph("revealPassword")
const HIDE = glyph("hidePassword")

/** The Grammar Input props that make a value copyable in place (copy glyph inside the field) and, for a secret, revealable. */
export const useCopyField = () => {
  const t = useT(connectionWizard)
  return {
    isCopyable: true,
    copyLabel: t("copy"),
    copiedLabel: t("copied"),
    copyIcon: COPY,
    copiedIcon: COPIED,
    revealLabel: t("reveal"),
    hideLabel: t("hide"),
    revealIcon: REVEAL,
    hideIcon: HIDE,
  } as const
}
