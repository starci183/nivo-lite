import { crc32, deflateSync } from "node:zlib"

/** The side of the square image a gradient is drawn on; ffmpeg scales it to the frame. */
const SIDE = 96

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

const CHANNELS = [0, 1, 2] as const

/** How a gradient runs: top to bottom, or corner to corner. */
export type GradientDirection = "vertical" | "diagonal"

/** The red, green and blue values of a #rrggbb colour. */
const channelsOf = (hex: string): readonly [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
]

const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, "ascii"), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([length, body, crc])
}

/** A 96x96 RGB PNG holding a two-colour gradient between two #rrggbb colours. Scaled to the frame by ffmpeg. */
export const gradientPng = (from: string, to: string, direction: GradientDirection): Buffer => {
    const start = channelsOf(from)
    const end = channelsOf(to)
    const stride = SIDE * 3 + 1
    const raw = Buffer.alloc(stride * SIDE)
    for (let y = 0; y < SIDE; y++) {
        for (let x = 0; x < SIDE; x++) {
            const t = direction === "vertical" ? y / (SIDE - 1) : (x + y) / (2 * (SIDE - 1))
            for (const channel of CHANNELS) {
                const a = start[channel]
                const b = end[channel]
                raw[y * stride + 1 + x * 3 + channel] = Math.round(a + (b - a) * t)
            }
        }
    }
    const header = Buffer.alloc(13)
    header.writeUInt32BE(SIDE, 0)
    header.writeUInt32BE(SIDE, 4)
    header[8] = 8 // bit depth
    header[9] = 2 // RGB
    return Buffer.concat([
        Buffer.from(PNG_SIGNATURE),
        chunk("IHDR", header),
        chunk("IDAT", deflateSync(raw)),
        chunk("IEND", Buffer.alloc(0)),
    ])
}
