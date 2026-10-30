import { Column, Entity, PrimaryColumn } from "typeorm"

import { AbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "n8n_platform_config" })
/** One platform setting n8n calls back with: one row of `public.n8n_platform_config`. */
export class N8nPlatformConfigEntity extends AbstractEntity {
    /** The setting key, for example `api_base`. */
    @PrimaryColumn({ name: "key", type: "text" })
    key!: string

    /** The setting value. */
    @Column({ name: "value", type: "text" })
    value!: string
}
