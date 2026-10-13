import type { BrandMaterial } from "@modules/domain/content-ai"
import type { ContentBrandMaterialType } from "./dto/content-brand-material.type"

/** Projects public brand knowledge into the browser contract. */
export const toBrandMaterialType = (result: BrandMaterial): ContentBrandMaterialType => ({
    shop: result.shop,
    authority: { ...result.authority },
    setup: { ...result.setup, facts: [...result.setup.facts] },
    sources: result.sources.map((source) => ({ ...source })),
    brainFacts: result.brainFacts.map((fact) => ({ ...fact })),
})
