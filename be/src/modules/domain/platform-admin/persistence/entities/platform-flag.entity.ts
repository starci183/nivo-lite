import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "platform_flags" })
/** One platform-wide switch: one row of `public.platform_flags`. */
export class PlatformFlagEntity extends AbstractEntity {
    /** The flag name. */
    @PrimaryColumn({ name: "key", type: "text" })
    key!: string

    /** True when the flag is on. */
    @Column({ name: "enabled", type: "boolean", default: () => "false" })
    enabled!: boolean
}
