import type { InstallTemplateListingRequest } from "../../application/install-template-listing.contracts"
import type { InstalledTemplate } from "@nivo-lite/agent-sdk/template"
import type { Locale } from "@modules/platform/i18n"
import type { InstallTemplateListingInput } from "./dto/install-template-listing.input"
import type { InstalledTemplateType } from "./dto/installed-template.type"
import { toInstalledTemplateType } from "./template-marketplace.records.mapper"

/** Maps the GraphQL arguments of installTemplateListing to the request. */
export const toInstallTemplateListingRequest = (
    workspaceId: string,
    input: InstallTemplateListingInput,
    locale: Locale,
): InstallTemplateListingRequest => ({
    workspaceId,
    listingId: input.listingId,
    values: input.values,
    name: input.name,
    locale,
})

/** Maps the answer to the GraphQL type. */
export const toInstallTemplateListingType = (result: InstalledTemplate): InstalledTemplateType =>
    toInstalledTemplateType(result)
