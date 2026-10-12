import type { ImapSecurity } from "@/lib/connectors/imap"

/** Mail providers with a known IMAP address. `other` asks for host and port. */
export type ImapPresetId = "gmail" | "outlook" | "zoho" | "yahoo" | "other"

export type ImapPreset = { readonly id: ImapPresetId; readonly host: string; readonly port: number }

export const IMAP_PRESETS: ReadonlyArray<ImapPreset> = [
  { id: "gmail", host: "imap.gmail.com", port: 993 },
  { id: "outlook", host: "outlook.office365.com", port: 993 },
  { id: "zoho", host: "imap.zoho.com", port: 993 },
  { id: "yahoo", host: "imap.mail.yahoo.com", port: 993 },
  { id: "other", host: "", port: 993 },
]

export const defaultPort = (security: ImapSecurity) => (security === "tls" ? 993 : 143)

/** The preset a saved host belongs to. */
export const presetOfHost = (host: string): ImapPresetId => IMAP_PRESETS.find((p) => p.host && p.host === host)?.id ?? "other"
