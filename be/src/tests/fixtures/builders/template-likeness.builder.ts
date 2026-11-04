import { builder } from "@starci/jest-preset"
import type { templateMarketplaceEntities } from "@modules/domain/template-marketplace"
import { CREATOR } from "./agent-template.builder"

/** The row of a stored consent. */
type LikenessGrantRow = InstanceType<(typeof templateMarketplaceEntities)[1]>

/** A stored consent of a person to the persona of a template, unverified and not taken back; the argument changes what a spec needs. */
export const likenessGrantRow: (changes?: Partial<LikenessGrantRow>) => LikenessGrantRow = builder<LikenessGrantRow>({
    id: "grant-1",
    templateKey: "spa-booking-by-linh",
    personName: "Ngoc Trinh",
    allowedUses: ["name", "voice_style"],
    disclosure: "Tro ly AI cua Ngoc Trinh",
    grantedBy: CREATOR.accountId,
    verifiedBy: null,
    verifiedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: new Date("2026-11-03T00:00:00.000Z"),
    updatedAt: new Date("2026-11-03T00:00:00.000Z"),
})
