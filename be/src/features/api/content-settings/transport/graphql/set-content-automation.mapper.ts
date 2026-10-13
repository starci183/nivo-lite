import type { ContentBrandSettings } from "@modules/domain/content-settings"
import type { SetContentAutomationRequest } from "../../application/set-content-automation.contracts"
import type { SetContentAutomationInput } from "./dto/set-content-automation.input"
import type { ContentBrandSettingsType } from "./dto/content-brand-settings.type"
import { toContentBrandSettingsType } from "./content-configuration-types.mapper"

/** Maps the GraphQL selection and configuration arguments. */
export const toSetContentAutomationRequest = (
    workspaceId: string,
    input: SetContentAutomationInput,
): SetContentAutomationRequest => ({
    workspaceId,
    key: input.key,
    on: input.on,
})

/** Maps the configuration result to the public GraphQL shape. */
export const toSetContentAutomationType = (result: ContentBrandSettings): ContentBrandSettingsType =>
    toContentBrandSettingsType(result)
