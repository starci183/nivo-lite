import "server-only"

import { decoded } from "../decode"
import type { Outcome } from "../outcome"
import { apiRequest } from "../request"
import { decodeMemberships } from "./workspaces.mapper"
import type { MembershipItem } from "./workspaces.mapper"

/** Reads every workspace the caller belongs to with the caller's seat in each. */
export const readMemberships = async (): Promise<Outcome<ReadonlyArray<MembershipItem>>> =>
    decoded(await apiRequest<unknown>("/workspaces"), decodeMemberships)
