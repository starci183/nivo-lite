import { OfficeMessenger } from "@/features/office/messenger"

/**
 * STATE-8: the Office itself, with no data yet - the same messenger frame, columns, heading and composer (disabled), the thread as
 * three skeleton messages. The client messenger is rendered directly: the server wrapper only adds the team and the deciders.
 */
const ChatLoading = () => (
    <OfficeMessenger
        isLoading
        workspaceId=""
        workspaceName=""
        userName=""
        avatarUrl={null}
        initialMessages={[]}
        agents={[]}
        pending={[]}
        decided={[]}
        exceptions={[]}
        decidedExceptions={[]}
        staff={[]}
        people={[]}
        deciders={{}}
        pendingDecisions={0}
        tasks={[]}
        customers={[]}
        leadNames={{}}
        nowIso=""
    />
)

export default ChatLoading
