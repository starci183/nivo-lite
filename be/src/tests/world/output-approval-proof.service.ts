import type { EntityManager } from "typeorm"

/** Switches only the proof conversation between its website and external-channel delivery boundary. */
export const setOutputProofChannel = async (
    manager: EntityManager,
    conversationId: string,
    external: boolean,
): Promise<void> => {
    const changed = external
        ? { channel: "telegram", externalId: "proof-recipient" }
        : { channel: "website", externalId: null }
    await manager.query(
        "UPDATE public.records SET data = data || $2::jsonb WHERE entity = 'chat.conversation' AND id = $1",
        [conversationId, JSON.stringify(changed)],
    )
}

/** The stored chat lines of the proof workspace under one channel key, as their fields. */
export const outputProofLines = async (
    manager: EntityManager,
    channelRef: string,
): Promise<Array<Record<string, unknown>>> => {
    const rows: Array<{ data: Record<string, unknown> }> = await manager.query(
        "SELECT data FROM public.records WHERE entity = 'chat.message' AND data->>'channelRef' = $1",
        [channelRef],
    )
    return rows.map((row) => row.data)
}

/** The stored chat line with this id, as its fields. */
export const outputProofLine = async (manager: EntityManager, id: string): Promise<Record<string, unknown>> => {
    const rows: Array<{ data: Record<string, unknown> }> = await manager.query(
        "SELECT data FROM public.records WHERE entity = 'chat.message' AND id = $1",
        [id],
    )
    return rows[0]?.data ?? {}
}
