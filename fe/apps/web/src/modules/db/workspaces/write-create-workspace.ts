"use server"
import "server-only"

import { apiRequest, decodeCreatedWorkspace, decoded } from "@/modules/api"

/** Creates a free workspace owned by the signed-in person through the back end api. */
export const writeCreateWorkspace = async (name: string) =>
    decoded(
        await apiRequest<unknown>("/workspaces", { method: "POST", body: { name: name.trim() } }),
        decodeCreatedWorkspace,
    )
