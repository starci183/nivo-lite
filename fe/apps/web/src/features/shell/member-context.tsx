"use client"

/** Wave 3 shim: the member context moved to `hooks/member` and `components/blocks/MemberProvider`. */
export { canDecideItem, isManager, useMember } from "@/hooks/member"
export type { ShellMember } from "@/hooks/member"
export { MemberProvider } from "@/components/blocks/MemberProvider"
