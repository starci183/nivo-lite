import type { InstallTemplateListingRequest } from "../../application/install-template-listing.contracts"
import type { InstalledTemplate } from "@nivo/agent-sdk/template"
import type { InstallTemplateListingInput } from "./dto/install-template-listing.input"
import type { InstalledTemplateType } from "./dto/installed-template.type"
import { toInstalledTemplateType, valuesOf } from "./template-marketplace.records.mapper"

/** Maps the GraphQL arguments of installTemplateListing to the request. */
export const toInstallTemplateListingRequest = (
    workspaceId: string,
    input: InstallTemplateListingInput,
): InstallTemplateListingRequest => ({
    workspaceId,
    listingId: input.listingId,
    values: valuesOf(input.values),
    name: input.name ?? null,
    locale: "vi",
})

/** Maps the answer to the GraphQL type. */
export const toInstallTemplateListingType = (result: InstalledTemplate): InstalledTemplateType =>
    toInstalledTemplateType(result)
