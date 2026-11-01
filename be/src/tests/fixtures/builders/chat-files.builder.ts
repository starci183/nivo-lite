/** The chat files of a thread that holds none. */
export const NO_CHAT_FILES = {
    viewsOf: () => Promise.resolve([]),
    wordsOf: (written: string) => written,
}

/** The reads of a turn whose message holds no file. */
export const NO_CHAT_FILE_READS = {
    readOf: () => Promise.resolve(null),
    attachmentsOf: () => Promise.resolve([]),
}
