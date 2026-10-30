import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"
import type { AutomationMarks, AutomationSwitches, GuidelineColor } from "../../content-settings.contracts"

@Entity({ schema: "public", name: "content_settings" })
/** One row of public.content_settings: the brand, guideline and automation settings of a workspace. */
export class ContentSettingsEntity extends AbstractEntity {
    /** The workspace the settings belong to. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The brand voice line drafts follow. */
    @Column({ name: "brand_voice", type: "text", default: () => "''::text" })
    brandVoice!: string

    /** What drafts avoid. */
    @Column({ name: "avoid", type: "text", default: () => "''::text" })
    avoid!: string

    /** The call to action. */
    @Column({ name: "cta", type: "text", default: () => "''::text" })
    cta!: string

    /** The brand hashtags. */
    @Column({ name: "hashtags", type: "text", array: true, default: () => "'{}'::text[]" })
    hashtags!: Array<string>

    /** Which automations are on. */
    @Column({
        name: "automations",
        type: "jsonb",
        default: () => `'{"offer_draft": false, "today_reminder": false, "weekly_summary": false}'::jsonb`,
    })
    automations!: AutomationSwitches

    /** The dedupe marks of the automations. */
    @Column({ name: "marks", type: "jsonb", default: () => "'{}'::jsonb" })
    marks!: AutomationMarks

    /** The palette read from a guideline. */
    @Column({ name: "brand_colors", type: "jsonb", default: () => "'[]'::jsonb" })
    brandColors!: Array<GuidelineColor>

    /** The font families. */
    @Column({ name: "brand_fonts", type: "text", array: true, default: () => "'{}'::text[]" })
    brandFonts!: Array<string>

    /** The tone of voice. */
    @Column({ name: "brand_tone", type: "text", default: () => "''::text" })
    brandTone!: string

    /** The imagery the guideline asks for. */
    @Column({ name: "brand_imagery", type: "text", array: true, default: () => "'{}'::text[]" })
    brandImagery!: Array<string>

    /** The file the brand was read from. */
    @Column({ name: "brand_source", type: "text", default: () => "''::text" })
    brandSource!: string
}
