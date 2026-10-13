"use server"

import { getTranslations } from "next-intl/server"
import { writeGoogleAuthorize } from "@/modules/db/connections/write-google-authorize"
import { getCurrentMember } from "./members"
import type { Outcome } from "./types"

/**
 * Compatibility wrapper for the automations screen: starts the Google consent of the signed-in member's workspace through the api
 * (which signs the state and checks the owner role) and answers the old Outcome with the sentence in the reader's language.
 * Wave 3 deletes this file when the automations screen calls the write from its own connected block.
 */
export const startGoogleConnect = async (returnTo: string): Promise<Outcome<{ url: string }>> => {
    const member = await getCurrentMember()
    const answer = await writeGoogleAuthorize({ workspaceId: member.workspaceId, returnTo })
    if (answer.kind === "ok") return { ok: true, data: { url: answer.value.url } }
    const t = await getTranslations("connections")
    return { ok: false, error: t(answer.code) }
}
