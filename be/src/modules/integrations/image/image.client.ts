import { Injectable } from "@nestjs/common"
import sharp from "sharp"
import { ImageError, ImageErrorCode } from "./errors/image.error"
import type { Image } from "./image.port"

/** The JPEG quality of every picture this integration writes. */
const JPEG_QUALITY = 84

@Injectable()
/** The one place that reads and draws pictures: the `sharp` library lives here and nowhere else. */
export class ImageClient implements Image {
    /** The photo cut to a square of `side` pixels as JPEG bytes. */
    cropSquare(bytes: Buffer, side: number): Promise<Buffer> {
        return sharp(bytes)
            .rotate()
            .resize(side, side, { fit: "cover" })
            .jpeg({ quality: JPEG_QUALITY })
            .toBuffer()
            .catch((cause: unknown) => {
                throw new ImageError({ code: ImageErrorCode.Failed, cause })
            })
    }

    /** The SVG document drawn on a white page as JPEG bytes. */
    rasterise(svg: string): Promise<Buffer> {
        return sharp(Buffer.from(svg))
            .flatten({ background: "#ffffff" })
            .jpeg({ quality: JPEG_QUALITY })
            .toBuffer()
            .catch((cause: unknown) => {
                throw new ImageError({ code: ImageErrorCode.Failed, cause })
            })
    }
}
