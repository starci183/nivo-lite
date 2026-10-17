/** Writes one operator report line to stdout with its final line break. */
export const printConsoleLine = (line: string): void => {
    process.stdout.write(`${line}\n`)
}
