import { createContext } from "react"

/** The signed-in member as client components need it (plain data: the server enforces every rule again). */
export type ShellMember = {
    readonly userId: string
    readonly name: string
    readonly role: "owner" | "manager" | "staff"
    readonly staffId: string | null
}

/** The context the console layout fills once, so any screen can ask what the signed-in person may do. */
export const MemberContext = createContext<ShellMember | null>(null)

/** Owner and manager run the business: authority, staff edits, any decision. */
export const isManager = (member: ShellMember | null): boolean =>
    member === null || member.role === "owner" || member.role === "manager"

/** May this person decide an item assigned to `assignedStaffId` (same rule as the server's canDecide)? */
export const canDecideItem = (member: ShellMember | null, assignedStaffId: string | null | undefined): boolean =>
    isManager(member) || (member !== null && member.staffId !== null && member.staffId === (assignedStaffId ?? null))
