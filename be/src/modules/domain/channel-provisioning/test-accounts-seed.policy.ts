import { isMailAddress } from "@modules/domain/email-messages"
import { invalid, sealedValuesOf, textOf } from "./management-seed.policy"
import type { Values } from "./management-seed.policy"
import { TEST_ACCOUNTS_SEED_SCHEMA } from "./test-accounts-seed.contracts"
import type { TestAccountsSeed, TestSeat, TestWorkspace } from "./test-accounts-seed.contracts"

const ROLES: ReadonlyArray<TestSeat["role"]> = ["owner", "manager", "staff"]

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)

const listOf = (value: unknown, field: string): ReadonlyArray<unknown> =>
    Array.isArray(value) && value.length > 0 ? value : invalid(field)

/** The sealed value a seat names by key; a key the member lacks is refused by the field's name. */
const sealedOf = (values: Values, key: unknown, field: string): string => values[textOf(key, field)] ?? invalid(field)

const seatOf = (raw: unknown, values: Values): TestSeat => {
    if (!isRecord(raw)) return invalid("seat")
    const role = ROLES.find((candidate) => candidate === raw.role) ?? invalid("seat.role")
    const email = sealedOf(values, raw.emailKey, "seat.emailKey").toLowerCase()
    if (!isMailAddress(email)) return invalid("seat.email")
    const password = sealedOf(values, raw.passwordKey, "seat.passwordKey")
    return { role, name: textOf(raw.name, "seat.name"), email, password }
}

const workspaceOf = (raw: unknown, values: Values): TestWorkspace => {
    if (!isRecord(raw)) return invalid("workspace")
    const [owner, ...others] = listOf(raw.seats, "workspace.seats").map((seat) => seatOf(seat, values))
    if (owner?.role !== "owner" || others.some((seat) => seat.role === "owner")) return invalid("workspace.owner")
    return { name: textOf(raw.name, "workspace.name"), owner, others }
}

/** Reads one test-accounts document: every workspace has one owner, listed first, and no address is used twice. */
export const readTestAccountsSeed = (document: unknown): TestAccountsSeed => {
    if (!isRecord(document) || document.schema !== TEST_ACCOUNTS_SEED_SCHEMA) return invalid("schema")
    const values = sealedValuesOf(document.values)
    const workspaces = listOf(document.workspaces, "workspaces").map((workspace) => workspaceOf(workspace, values))
    const emails = workspaces.flatMap((workspace) => [workspace.owner, ...workspace.others]).map((seat) => seat.email)
    return new Set(emails).size === emails.length ? { workspaces } : invalid("seat.email")
}
