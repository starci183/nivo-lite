import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"
import type { ListingCheck, ListingStatus } from "../../template-marketplace.contracts"

const vnd = { to: (value: number): number => value, from: (value: string): number => Number(value) }

@Entity({ schema: "public", name: "template_listings" })
/** One template version offered to others, with its review. */
export class TemplateListingEntity extends UuidAbstractEntity {
    /** The template key. */
    @Column({ name: "template_key", type: "text" })
    templateKey!: string

    /** The version offered. */
    @Column({ name: "version", type: "integer" })
    version!: number

    /** The review state. */
    @Column({ name: "status", type: "text", default: "draft" })
    status!: ListingStatus

    /** The price in VND; zero is free. */
    @Column({ name: "price_vnd", type: "bigint", transformer: vnd })
    priceVnd!: number

    /** The percent of a sale that is the creator. */
    @Column({ name: "revenue_share_pct", type: "integer", default: 70 })
    revenueSharePct!: number

    /** What the automated checks found at the last submit. */
    @Column({ name: "checks", type: "jsonb", default: () => "'[]'::jsonb" })
    checks!: Array<ListingCheck>

    /** What the reviewer wrote. */
    @Column({ name: "review_note", type: "text", default: () => "''" })
    reviewNote!: string

    /** True for a listing of the platform itself. */
    @Column({ name: "first_party", type: "boolean", default: false })
    firstParty!: boolean

    /** Who submitted it. */
    @Column({ name: "submitted_by", type: "uuid", nullable: true })
    submittedBy!: string | null

    /** Who reviewed it. */
    @Column({ name: "reviewed_by", type: "uuid", nullable: true })
    reviewedBy!: string | null

    /** When it was reviewed. */
    @Column({ name: "reviewed_at", type: "timestamptz", nullable: true })
    reviewedAt!: Date | null
}
