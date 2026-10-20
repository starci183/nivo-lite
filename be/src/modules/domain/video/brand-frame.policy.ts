/** ffmpeg's colour of a #rrggbb brand colour. */
const ffColor = (hex: string): string => `0x${hex.slice(1)}`

/** The brand frame over every frame: a primary-colour border (2.2 % of the short side) with a thin secondary line inside it. */
export const frameFilter = (input: string, primary: string, secondary: string, shortSide: number): string => {
    const outer = Math.max(4, Math.round(shortSide * 0.022))
    const inner = Math.max(2, Math.round(shortSide * 0.004))
    return (
        `[${input}]drawbox=x=0:y=0:w=iw:h=ih:color=${ffColor(primary)}:t=${outer},` +
        `drawbox=x=${outer}:y=${outer}:w=iw-${outer * 2}:h=ih-${outer * 2}:color=${ffColor(secondary)}:t=${inner}[fr]`
    )
}
