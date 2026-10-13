import { decodeList, decodeOne, isRecord, isTextOrNull } from "../decode"
import type { Outcome } from "../outcome"

/** One workspace the caller belongs to, with the caller's seat in it. */
export interface MembershipItem {
    readonly workspaceId: string
    readonly name: string
    /** `active`, `pending_payment` or `cancelled`. */
    readonly status: string
    /** ISO 8601. */
    readonly createdAt: string
    readonly businessType: string | null
    /** `owner`, `manager` or `staff`. */
    readonly role: string
    /** `active` or `disabled`. */
    readonly memberStatus: string
}

/** The workspace a caller just created. */
export interface CreatedWorkspaceItem {
    readonly id: string
}

const isMembershipShape = (
    value: unknown,
): value is Record<string, unknown> & {
    readonly workspace: Record<string, unknown>
    readonly member: Record<string, unknown>
} => isRecord(value) && isRecord(value.workspace) && isRecord(value.member)

const isMembership = (
    value: unknown,
): value is { readonly workspace: Record<string, unknown>; readonly member: Record<string, unknown> } =>
    isMembershipShape(value) &&
    typeof value.workspace.id === "string" &&
    typeof value.workspace.name === "string" &&
    typeof value.workspace.status === "string" &&
    typeof value.workspace.createdAt === "string" &&
    isTextOrNull(value.workspace.businessType) &&
    typeof value.member.role === "string" &&
    typeof value.member.status === "string"

const isCreated = (value: unknown): value is CreatedWorkspaceItem => isRecord(value) && typeof value.id === "string"

const decodeRaw = decodeList(isMembership)

/** Reads the answer of list memberships into flat items. */
export const decodeMemberships = (value: unknown): Outcome<ReadonlyArray<MembershipItem>> => {
    const raw = decodeRaw(value)
    if (raw.kind !== "ok") return raw
    return {
        kind: "ok",
        value: raw.value.map((entry): MembershipItem => ({
            workspaceId: String(entry.workspace.id),
            name: String(entry.workspace.name),
            status: String(entry.workspace.status),
            createdAt: String(entry.workspace.createdAt),
            businessType: typeof entry.workspace.businessType === "string" ? entry.workspace.businessType : null,
            role: String(entry.member.role),
            memberStatus: String(entry.member.status),
        })),
    }
}

/** Reads the answer of create workspace. */
export const decodeCreatedWorkspace = decodeOne(isCreated)
