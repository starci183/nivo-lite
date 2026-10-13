import "server-only"

import { request } from "../client"
import type { Outcome } from "../outcome"
import { decodeMemberships } from "./workspaces.mapper"
import type { MembershipItem } from "./workspaces.mapper"

/** What a memberships read needs: the caller token and the page language. */
export interface MembershipsQuery {
    readonly token: string
    readonly locale: string
}

/** Reads every workspace the caller belongs to with the caller's seat in each. */
export const readMemberships = (query: MembershipsQuery): Promise<Outcome<ReadonlyArray<MembershipItem>>> =>
    request({ ...query, path: "/workspaces" }, decodeMemberships)
