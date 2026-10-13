import type { ContentBrandSettings } from "@modules/domain/content-settings"
import type { SaveContentBrandRequest } from "../../application/save-content-brand.contracts"
import type { SaveContentBrandInput } from "./dto/save-content-brand.input"
import type { ContentBrandSettingsType } from "./dto/content-brand-settings.type"
import { toContentBrandSettingsType } from "./content-configuration-types.mapper"

/** Maps the GraphQL selection and configuration arguments. */
export const toSaveContentBrandRequest = (
    workspaceId: string,
    input: SaveContentBrandInput,
): SaveContentBrandRequest => ({
    workspaceId,
    brand: {
        brandVoice: input.brandVoice,
        avoid: input.avoid,
        cta: input.cta,
        hashtags: input.hashtags,
    },
})

/** Maps the configuration result to the public GraphQL shape. */
export const toSaveContentBrandType = (result: ContentBrandSettings): ContentBrandSettingsType =>
    toContentBrandSettingsType(result)
