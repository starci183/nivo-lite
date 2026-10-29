import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import type { ContentEvidence, ContentLink, ContentMediaRef, ContentVariant } from "../../content-editor.contracts"

@Entity({ schema: "public", name: "content_items" })
/** One row of public.content_items: a post from idea to published, with its per-channel text, media and history. */
export class ContentItemEntity {
    /** The post id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace that owns the post. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The monthly plan that produced the post, when one did. */
    @Column({ name: "plan_id", type: "uuid", nullable: true })
    planId!: string | null

    /** The title, 1 to 200 characters. */
    @Column({ name: "title", type: "text" })
    title!: string

    /** What the post is about. */
    @Column({ name: "brief", type: "text", default: () => "''::text" })
    brief!: string

    /** The content theme (pillar) of the post. */
    @Column({ name: "pillar_id", type: "uuid", nullable: true })
    pillarId!: string | null

    /** The channels it goes to. */
    @Column({ name: "channels", type: "text", array: true, default: () => "'{facebook}'::text[]" })
    channels!: Array<string>

    /** When it should be published. */
    @Column({ name: "scheduled_at", type: "timestamptz", nullable: true })
    scheduledAt!: Date | null

    /** idea, draft, waiting_approval, approved, published or skipped. */
    @Column({ name: "status", type: "text", default: () => "'idea'::text" })
    status!: string

    /** The text of each channel. */
    @Column({ name: "variants", type: "jsonb", default: () => "'{}'::jsonb" })
    variants!: Record<string, ContentVariant>

    /** The hashtags. */
    @Column({ name: "hashtags", type: "text", array: true, default: () => "'{}'::text[]" })
    hashtags!: Array<string>

    /** The attached media. */
    @Column({ name: "media", type: "jsonb", default: () => "'[]'::jsonb" })
    media!: Array<ContentMediaRef>

    /** The attached links. */
    @Column({ name: "links", type: "jsonb", default: () => "'[]'::jsonb" })
    links!: Array<ContentLink>

    /** The holiday the post marks. */
    @Column({ name: "holiday_key", type: "text", nullable: true })
    holidayKey!: string | null

    /** The history lines. */
    @Column({ name: "evidence", type: "jsonb", default: () => "'[]'::jsonb" })
    evidence!: Array<ContentEvidence>

    /** Where each channel scheduled or published the post. */
    @Column({ name: "published", type: "jsonb", default: () => "'{}'::jsonb" })
    published!: Record<string, unknown>

    /** The gate work item holding the post for approval. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** When the text was drafted. */
    @Column({ name: "drafted_at", type: "timestamptz", nullable: true })
    draftedAt!: Date | null

    /** Who approved the post. */
    @Column({ name: "approved_by", type: "text", nullable: true })
    approvedBy!: string | null

    /** When it was approved. */
    @Column({ name: "approved_at", type: "timestamptz", nullable: true })
    approvedAt!: Date | null

    /** When every channel had published it. */
    @Column({ name: "published_at", type: "timestamptz", nullable: true })
    publishedAt!: Date | null

    /** manual, plan, quick, offer or automation. */
    @Column({ name: "source", type: "text", default: () => "'manual'::text" })
    source!: string

    /** Who created the post. */
    @Column({ name: "created_by", type: "text", default: () => "''::text" })
    createdBy!: string

    /** When the post was created. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** When the post last changed. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date
}
