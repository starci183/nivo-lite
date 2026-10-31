import { AbstractEntity } from "@modules/platform/database"
import { Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "platform_admins" })
/** One platform team member allowed into the admin console: one row of `public.platform_admins`. */
export class PlatformAdminEntity extends AbstractEntity {
    /** The admin's email, lower case and trimmed. */
    @PrimaryColumn({ name: "email", type: "text" })
    email!: string
}
