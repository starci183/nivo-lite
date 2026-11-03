import { CreatorLedgerEntryEntity } from "./creator-ledger-entry.entity"
import { TemplateLikenessGrantEntity } from "./template-likeness-grant.entity"
import { TemplateListingEntity } from "./template-listing.entity"

export { CreatorLedgerEntryEntity, TemplateLikenessGrantEntity, TemplateListingEntity }

/** Every entity the template-marketplace capability owns, collected by the database connection. */
export const templateMarketplaceEntities: readonly [
    typeof CreatorLedgerEntryEntity,
    typeof TemplateLikenessGrantEntity,
    typeof TemplateListingEntity,
] = [CreatorLedgerEntryEntity, TemplateLikenessGrantEntity, TemplateListingEntity]
