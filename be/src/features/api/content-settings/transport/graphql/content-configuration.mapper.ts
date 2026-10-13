import type { ContentConfiguration } from "@modules/domain/content-settings"
import type { ContentConfigurationRequest } from "../../application/content-configuration.contracts"
import type { ContentConfigurationType } from "./dto/content-configuration.type"
import {
    toContentBrandSettingsType,
    toContentCadenceType,
    toContentPillarType,
} from "./content-configuration-types.mapper"

/** Maps the GraphQL selection and configuration arguments. */
export const toContentConfigurationRequest = (workspaceId: string): ContentConfigurationRequest => ({
    workspaceId,
})

/** Maps the configuration result to the public GraphQL shape. */
export const toContentConfigurationType = (result: ContentConfiguration): ContentConfigurationType => ({
    pillars: result.pillars.map(toContentPillarType),
    cadence: result.cadence.map(toContentCadenceType),
    settings: toContentBrandSettingsType(result.settings),
})
