import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import type { SetupMessageRole } from "../../module-setup-messages.contracts"

@Entity({ schema: "public", name: "module_setup_messages" })
/** One line of the setup chat of an installation: one row of `public.module_setup_messages`. */
export class ModuleSetupMessageEntity {
    /** The message. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The session it belongs to. */
    @Column({ name: "setup_session_id", type: "uuid" })
    setupSessionId!: string

    /** Who speaks. */
    @Column({ name: "role", type: "text" })
    role!: SetupMessageRole

    /** The display name of the author. */
    @Column({ name: "author", type: "text", default: () => "''" })
    author!: string

    /** The text. */
    @Column({ name: "body", type: "text" })
    body!: string

    /** When it was written. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
