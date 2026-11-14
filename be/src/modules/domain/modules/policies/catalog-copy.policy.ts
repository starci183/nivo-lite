import type { Bilingual } from "../modules.contracts"
import vi from "../messages/vi.json"
import en from "../messages/en.json"

type CatalogCopyKey = keyof typeof vi

/** Reads a catalog message in both product languages. */
export const catalogText = (key: CatalogCopyKey): Bilingual => ({ vi: vi[key], en: en[key] })
