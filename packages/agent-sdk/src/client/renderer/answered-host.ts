import type { HostRead, WorkbenchHost } from "../../host/host.types"

/**
 * The host a block draws with when the answer of its read is already in hand (a screen that ran the read for the block): a read named in
 * `answers` is answered from it (ready, no paging, never run again), and every other read, action and port is the live host's. The live
 * read is still called for the answered operation, with no variables, so the hooks of a block keep the same order and nothing is requested.
 */
export const hostAnswering = (host: WorkbenchHost, answers: Readonly<Record<string, unknown>>): WorkbenchHost => ({
    ...host,
    useRead: (operation, variables, options) => {
        const isAnswered = Object.keys(answers).includes(operation)
        const live = host.useRead(operation, isAnswered ? null : variables, options)
        if (!isAnswered) return live
        const answered: HostRead = { status: "ready", data: answers[operation], isValidating: false, reload: () => undefined, page: null }
        return answered
    },
})
