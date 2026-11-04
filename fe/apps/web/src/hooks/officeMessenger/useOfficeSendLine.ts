import { useCallback } from "react"
import { isManager, useMember } from "@/hooks/member"
import type { OfficeBoard, useOfficeSend } from "@/hooks/office"
import { acceptsCommands, mentionsOf } from "@/modules/office"

/** The lines the sender needs about a body: the agents it calls and, for an owner or manager, the one command the server reads. */
export const useOfficeSendLine = (
    agents: OfficeBoard["agents"],
    sender: ReturnType<typeof useOfficeSend>,
    roomKey: string | null,
): ((body: string) => Promise<boolean>) => {
    const me = useMember()
    return useCallback(
        (body: string): Promise<boolean> => {
            const called = mentionsOf(body)
            const active = agents.filter((agent) => agent.isActive)
            const target = called.length === 1 ? active.find((agent) => agent.handle === called[0]) : undefined
            const canRead = isManager(me)
            return sender.send({
                body,
                room: roomKey,
                callNames: active.filter((agent) => called.includes(agent.handle)).map((agent) => agent.name),
                reading:
                    canRead && target !== undefined && acceptsCommands(target.module)
                        ? { handle: target.handle, module: target.module }
                        : null,
            })
        },
        [agents, me, sender, roomKey],
    )
}
