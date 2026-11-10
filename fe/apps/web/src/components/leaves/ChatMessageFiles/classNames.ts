import { cn } from "@heroui/react"

/** A chat picture keeps a readable width whatever its own size. */
export const CHAT_IMAGE_CLASS_NAME: string | undefined = cn("max-w-72")

/** An album of pictures is a little wider than one picture, so two squares stay readable side by side. */
export const CHAT_ALBUM_CLASS_NAME: string | undefined = cn("max-w-80")
