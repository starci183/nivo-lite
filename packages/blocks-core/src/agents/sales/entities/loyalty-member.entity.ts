import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_ID, MAX_LINE } from "../../../shared/bounds"
import { SALES_LOYALTY_MEMBER_ENTITY } from "../../../shared/entities/sales-entity-names"

/** Whether a customer bought lately, has gone quiet or is too new to tell. */
export const MEMBER_ACTIVITIES: readonly [string, ...Array<string>] = ["active", "at_risk", "new"]

/** What `lastActivityAt` holds for a customer who never bought: the epoch, so the "newest purchase first" order puts them last. */
export const NEVER_BOUGHT = "1970-01-01T00:00:00.000Z"

/** The longest note of the owner. */
const MAX_NOTE = 2_000

type MemberFields = {
    readonly name: FieldDef<"text", false>
    readonly phone: FieldDef<"text", true>
    readonly email: FieldDef<"text", true>
    readonly contact: FieldDef<"text", false>
    readonly birthday: FieldDef<"date", true>
    readonly note: FieldDef<"text", false>
    readonly tierKey: FieldDef<"text", true>
    readonly tier: FieldDef<"text", false>
    readonly points: FieldDef<"int", false>
    readonly lifetimeSpendVnd: FieldDef<"money_vnd", false>
    readonly visits: FieldDef<"int", false>
    readonly lastVisitAt: FieldDef<"timestamptz", true>
    readonly lastActivityAt: FieldDef<"timestamptz", false>
    readonly joinedAt: FieldDef<"timestamptz", false>
    readonly activity: FieldDef<"enum", false>
    readonly contactId: FieldDef<"contact", true>
}

const memberFields: MemberFields = {
    name: field.text({ maxLength: MAX_LINE, searchable: true }),
    phone: field.text({ maxLength: 30, nullable: true }),
    email: field.text({ maxLength: MAX_LINE, nullable: true }),
    contact: field.text({ maxLength: MAX_LINE, searchable: true, default: "empty" }),
    birthday: field.date({ nullable: true }),
    note: field.text({ maxLength: MAX_NOTE, default: "empty" }),
    tierKey: field.text({ maxLength: MAX_ID, nullable: true }),
    tier: field.text({ maxLength: MAX_LINE, default: "empty" }),
    points: field.int({ default: { literal: 0 } }),
    lifetimeSpendVnd: field.moneyVnd({ default: { literal: 0 } }),
    visits: field.int({ default: { literal: 0 } }),
    lastVisitAt: field.timestamptz({ nullable: true }),
    lastActivityAt: field.timestamptz({ default: { literal: NEVER_BOUGHT } }),
    joinedAt: field.timestamptz({ default: "now" }),
    activity: field.enum({ of: MEMBER_ACTIVITIES, default: { literal: "new" } }),
    /** The person (the core contact) the member is; erased with the contact (a membership is the person's data). */
    contactId: field.contact({ nullable: true }),
}

/** One column of an index: ascending, or descending. */
type IndexColumn = string | { readonly desc: string }

/** The four sorts the members list takes: newest visit, most points, largest spend, name. */
const SORTS: ReadonlyArray<readonly [string, ReadonlyArray<IndexColumn>]> = [
    ["recent", [{ desc: "lastActivityAt" }, { desc: "id" }]],
    ["points", [{ desc: "points" }, { desc: "id" }]],
    ["spend", [{ desc: "lifetimeSpendVnd" }, { desc: "id" }]],
    ["name", ["name", "id"]],
]

/** One index per sort, alone and under each filter the list takes, so no list query runs unindexed. */
const sortIndexes = (
    prefix: string,
    lead: ReadonlyArray<string>,
): ReadonlyArray<{ readonly name: string; readonly on: ReadonlyArray<IndexColumn> }> =>
    SORTS.map(([name, columns]) => ({ name: `${prefix}${name}`, on: [...lead, ...columns] }))

/**
 * A customer of the loyalty programme. The points, the spend, the last purchase (`lastActivityAt`, the epoch before the first one, because the engine cannot say NULLS LAST), the tier (its key and its name) and the activity are kept with every
 * ledger entry the actions post, so the list filters, sorts and counts on stored fields only. Graph node kind `loyalty-member`.
 */
export const loyaltyMemberEntity: EntityDefinition<MemberFields> = defineEntity({
    name: SALES_LOYALTY_MEMBER_ENTITY,
    dataKind: "loyalty-member",
    fields: memberFields,
    indexes: [
        ...sortIndexes("", []),
        ...sortIndexes("activity_", ["activity"]),
        ...sortIndexes("tier_", ["tierKey"]),
        { name: "phone", on: ["phone", "id"] },
        { name: "email", on: ["email", "id"] },
        { name: "contact", on: ["contactId", "id"] },
    ],
    constraints: [
        {
            kind: "unique",
            name: "phone_key",
            on: ["phone"],
            where: { op: "notNull", field: "phone" },
            refusal: "member-phone-taken",
        },
        {
            kind: "unique",
            name: "email_key",
            on: ["email"],
            where: { op: "notNull", field: "email" },
            refusal: "member-email-taken",
        },
    ],
    matchKeys: [
        { name: "phone", on: ["phone"] },
        { name: "email", on: ["email"] },
    ],
})
