import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "contact_memory" })
/**
 * One entry of what the workflows remember of a person (their contact, else the conversation of a person no contact holds yet): the
 * latest outcome of one node of one workflow namespace, the trigger of a workflow's latest run, or the facts the nodes proved. Core
 * contact data: a merge moves the entries to the survivor; a soft-deleted contact keeps them (nothing cascades) and they are left out of every read.
 */
export class ContactMemoryEntryEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The unique key of the entry in the workspace: the subject, the workflow namespace, the node. */
    @Column({ name: "entry_key", type: "text" })
    entryKey!: string

    /** Whom the entry is about: `contact:<id>`, `conversation:<id>` (or a module's own bridge key). */
    @Column({ name: "subject_key", type: "text" })
    subjectKey!: string

    /** The contact, when the subject is one. */
    @Column({ name: "contact_id", type: "uuid", nullable: true })
    contactId!: string | null

    /** The conversation the person came from, when known; a chatbot record, no foreign key. */
    @Column({ name: "route_id", type: "uuid", nullable: true })
    conversationId!: string | null

    /** The workflow namespace (`$lead` for the facts). */
    @Column({ name: "namespace", type: "text" })
    namespace!: string

    /** The node key (`$facts`, `$trigger` for the two special entries). */
    @Column({ name: "node_key", type: "text" })
    nodeKey!: string

    /** The step id of the node, when it is one. */
    @Column({ name: "step", type: "text", nullable: true })
    step!: string | null

    /** `done`, `failed`, `passed_over`, `trigger` or `facts`. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** The agent whose step wrote it: attribution, not scope. */
    @Column({ name: "agent_id", type: "uuid", nullable: true })
    agentId!: string | null

    /** The workflow of the run that wrote it. */
    @Column({ name: "workflow_id", type: "uuid", nullable: true })
    workflowId!: string | null

    /** The run that wrote it. */
    @Column({ name: "run_id", type: "uuid", nullable: true })
    runId!: string | null

    /** The graph version the run ran. */
    @Column({ name: "version_id", type: "uuid", nullable: true })
    versionId!: string | null

    /** What it holds, as `{ value }`: opaque to the store. */
    @Column({ name: "output", type: "jsonb" })
    output!: object

    /** The failure of a failed step, or null. */
    @Column({ name: "error", type: "jsonb", nullable: true })
    error!: object | null

    /** When the outcome happened. */
    @Column({ name: "written_at", type: "timestamptz" })
    writtenAt!: Date

    /** When the person's memory closed, or null while it is open. */
    @Column({ name: "closed_at", type: "timestamptz", nullable: true })
    closedAt!: Date | null

    /** When the entry goes (the retention). */
    @Column({ name: "expires_at", type: "timestamptz" })
    expiresAt!: Date

    /** The fence of every write: bumped by each one. */
    @Column({ name: "version", type: "integer", default: () => "1" })
    version!: number
}
