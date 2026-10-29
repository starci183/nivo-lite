import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

/** Reads the bigint amount as the number the contract carries; the amount is never larger than a safe integer. */
const amountTransformer = {
    to: (value: number | null): number | null => value,
    from: (value: string | number | null): number | null => (value === null ? null : Number(value)),
}

@Entity({ schema: "public", name: "contracts" })
/** One row of public.contracts: a recurring contract the renewal automation reads. */
export class ContractEntity {
    /** The contract row id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace the contract belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The lead the contract was won from; null when entered without one. */
    @Column({ name: "lead_id", type: "uuid", nullable: true })
    leadId!: string | null

    /** The customer the contract is signed with. */
    @Column({ name: "customer_name", type: "text" })
    customerName!: string

    /** The plan or package the customer bought. */
    @Column({ name: "plan", type: "text", default: () => "''::text" })
    plan!: string

    /** The first day the contract is in force, YYYY-MM-DD. */
    @Column({ name: "starts_on", type: "date" })
    startsOn!: string

    /** The last day the contract is in force, YYYY-MM-DD. */
    @Column({ name: "ends_on", type: "date" })
    endsOn!: string

    /** The contract value in VND; null when not recorded. */
    @Column({ name: "amount_vnd", type: "bigint", nullable: true, transformer: amountTransformer })
    amountVnd!: number | null

    /** The stored lifecycle status. */
    @Column({ name: "status", type: "text", default: () => "'active'::text" })
    status!: string

    /** Free-text remarks kept with the contract. */
    @Column({ name: "note", type: "text", default: () => "''::text" })
    note!: string

    /** When the contract was created. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** When the contract last changed. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date
}
