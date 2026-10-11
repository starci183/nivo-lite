"use client"

import { IconTile, Image } from "@starci/grammar/common"
import type { Connection, Provider } from "@/lib/channels"
import { PROVIDER_LOGO } from "@/lib/connection-providers"
import { bankLogo } from "@/lib/vn-banks"
import { nivoIconSource } from "@/ui"
import { BANK_FRAME_CLASS, PROVIDER_LOGO_CLASS } from "./classNames"

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

/**
 * The identity mark of one connection row: a bank feed shows its bank's own wordmark in a fixed 64x40 frame (a bank logo is a
 * horizontal wordmark, which a square tile would shrink to a sliver; trimmed of its whitespace in public/logos/banks) (several accounts of one provider are told apart at a
 * glance by bank, then by name and the account's last digits); every other connection shows its provider's mark.
 */
export const AccountLogo = ({ connection }: { readonly connection: Connection }) => {
  const code = connection.meta.bank_code ?? ""
  const src = BANK_PROVIDERS.has(connection.provider) ? bankLogo(code) : null
  return src
    ? <span className={BANK_FRAME_CLASS}><Image src={src} alt="" aspect="auto" fit="contain" plate="none" width={64} height={26} /></span>
    : <ProviderLogo provider={connection.provider} />
}

const BANK_PROVIDERS: ReadonlySet<string> = new Set(["sepay", "casso"])
