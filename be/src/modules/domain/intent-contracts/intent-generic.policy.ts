/** The lines of a text that a pattern matches, each as "path:line: text", so a spec can name the words a file may not hold. */
export const lineHitsOf = (path: string, text: string, pattern: RegExp): ReadonlyArray<string> =>
    text.split("\n").flatMap((line, index) => (pattern.test(line) ? [`${path}:${index + 1}: ${line.trim()}`] : []))
