"use client"

import { IconTile, Image } from "@starci/grammar/common"
import type { Provider } from "@/lib/channels"
import { PROVIDER_LOGO } from "@/lib/connection-providers"
import { bankLogo } from "@/lib/vn-banks"
import { nivoIconSource } from "@/ui"
import { BANK_LOGO_CLASS, PROVIDER_LOGO_CLASS } from "./classNames"

/** The provider's own mark in a neutral tile (outgoing email, which has no brand, keeps the envelope glyph). Decorative: the name sits beside it. */
export const ProviderLogo = ({ provider }: { readonly provider: Provider }) => {
  const src = PROVIDER_LOGO[provider]
  return (
    <IconTile
      source={nivoIconSource("email", "leading")} tone="neutral" size="md"
      artwork={src ? <Image src={src} alt="" aspect="square" fit="contain" width={28} height={28} className={PROVIDER_LOGO_CLASS} /> : undefined}
    />
  )
}

/** The bank's logo next to its account facts; nothing when the bank is not in NIVO's list. */
export const BankLogo = ({ code, name }: { readonly code: string; readonly name: string }) => {
  const src = bankLogo(code)
  return src ? <span className={BANK_LOGO_CLASS}><Image src={src} alt={name} aspect="wide" fit="contain" width={56} height={21} /></span> : null
}
