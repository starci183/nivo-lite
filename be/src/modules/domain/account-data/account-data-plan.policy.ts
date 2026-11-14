import type { AccountDataPlan, AccountDataTypeDef, AccountPlanPartition } from "./account-data.contracts"
import { accountCheckNameOf, accountIndexNameOf, accountPartitionOf, byName } from "./account-data.policy"

/** The partition of one declaration: a CHECK per member, an index per declared index, in declaration order. */
const partitionOf = (def: AccountDataTypeDef): AccountPlanPartition => ({
    type: def.name,
    partition: accountPartitionOf(def.name),
    checks: Object.entries(def.fields).map(([field, declared]) => ({
        name: accountCheckNameOf(def.name, field),
        field,
        fieldType: declared.type,
        required: declared.required,
        ...(declared.maxLength === undefined ? {} : { maxLength: declared.maxLength }),
    })),
    indexes: (def.indexes ?? []).map((index) => ({
        name: accountIndexNameOf(def.name, index.name),
        fields: index.on.map((field) => ({ name: field, fieldType: def.fields[field]?.type ?? "text" })),
    })),
})

/**
 * The DDL-free plan of the declared types, sorted by type name: the partition, CHECKs and expression indexes each one needs, as data.
 * `cli account-data plan --json` prints it and `scripts/account-data-ddl.mjs` renders it into the generated migration (no SQL text
 * lives in the back end).
 */
export const accountDataPlanOf = (types: ReadonlyArray<AccountDataTypeDef>): AccountDataPlan => ({
    partitions: [...types].sort((left, right) => byName(left.name, right.name)).map((def) => partitionOf(def)),
})
