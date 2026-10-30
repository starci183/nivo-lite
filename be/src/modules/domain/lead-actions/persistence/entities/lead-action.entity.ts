import { Column, Entity } from "typeorm"
import type { ValueTransformer } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import type { Locale } from "@modules/platform/i18n"
import type { LeadAction, LeadActionInput, LeadActionResult, LeadActionStatus } from "../../lead-actions.contracts"

/** Reads the fencing token, a Postgres `bigint` the driver returns as text, as the number the fence contracts carry. */
const tokenAsNumber: ValueTransformer = {
    to: (value: number | null | undefined) => value,
    from: (value: string | null) => (value === null ? null : Number(value)),
}

@Entity({ schema: "public", name: "lead_actions" })
/** One queued, running or finished lead action of a workspace: a row of public.lead_actions. */
export class LeadActionEntity extends UuidAbstractEntity {
    /** The owning workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The member who requested the action. */
    @Column({ name: "requested_by", type: "uuid" })
    requestedBy!: string

    /** The supported action. */
    @Column({ name: "action", type: "text" })
    action!: LeadAction

    /** The validated action input (jsonb). */
    @Column({ name: "input", type: "jsonb" })
    input!: LeadActionInput

    /** The output language. */
    @Column({ name: "locale", type: "text" })
    locale!: Locale

    /** The progress. */
    @Column({ name: "status", type: "text", default: () => "'queued'::text" })
    status!: LeadActionStatus["status"]

    /** The job whose fence the run holds; null until it begins. */
    @Column({ name: "job_id", type: "uuid", nullable: true })
    jobId!: string | null

    /** The fencing token of the worker that holds the run. */
    @Column({ name: "fencing_token", type: "bigint", nullable: true, transformer: tokenAsNumber })
    fencingToken!: number | null

    /** The terminal result (jsonb). */
    @Column({ name: "result", type: "jsonb", nullable: true })
    result!: LeadActionResult | null

    /** The terminal error code. */
    @Column({ name: "error_code", type: "text", nullable: true })
    errorCode!: string | null
}
