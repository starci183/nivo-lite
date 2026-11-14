/** The words of a message with its `{count}` replaced by the number. */
export const countedWords = (template: string, count: number | string): string =>
    template.replaceAll("{count}", String(count))
