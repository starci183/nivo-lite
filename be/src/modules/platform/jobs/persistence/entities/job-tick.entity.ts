import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "job_ticks" })
/** The last minute a scheduled tick fired: the row every replica races to move forward so the tick enqueues once per minute. */
export class JobTickEntity extends AbstractEntity {
    /** The tick name. */
    @PrimaryColumn({ name: "name", type: "varchar", length: 200 })
    name!: string

    /** The UTC minute (YYYY-MM-DDTHH:MM) the tick last fired in. */
    @Column({ name: "minute", type: "varchar", length: 16 })
    minute!: string
}
