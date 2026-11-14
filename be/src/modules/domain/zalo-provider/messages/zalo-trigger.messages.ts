/**
 * The label a customer's picture or file is read as in front of its caption ("[ảnh] em chuyển rồi"), in the shop's language (Vietnamese: the
 * wake's words have always been Vietnamese). The same words as the conversations bundle's `conversations.imageLabel` /
 * `conversations.fileLabel`: the trigger's translate is pure, so it reads them as constants of the provider, not from the catalog.
 */
export const ZALO_ATTACHMENT_LABELS: Readonly<Record<"image" | "file", string>> = {
    image: "[ảnh]",
    file: "[tệp]",
}
