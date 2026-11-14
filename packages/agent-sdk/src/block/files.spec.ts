import { sampleBlockFiles } from "../tests/fixtures"
import { FILE_UNBOUND, filesVia } from "./files"

const photo = new File(["x"], "photo.png", { type: "image/png" })

describe("filesVia", () => {
    it("sends a change through the bound action and a read of the file through the bound read", async () => {
        const store = sampleBlockFiles()
        const files = filesVia(store, { read: "video.brand.get", write: "video.brand.save" })
        await files.upload("video.brand", "b1", "music", photo)
        await files.url("video.brand", "b1", "music")
        await files.remove("video.brand", "b1", "music")
        await files.url("video.brand", "b1", "photos", "k1")
        expect(store.calls()).toEqual([
            "upload video.brand.save video.brand/b1/music: photo.png",
            "url video.brand.get video.brand/b1/music",
            "remove video.brand.save video.brand/b1/music",
            "url video.brand.get video.brand/b1/photos#k1",
        ])
    })

    it("reads through the action when the node bound no read", async () => {
        const store = sampleBlockFiles()
        await filesVia(store, { read: null, write: "video.brand.save" }).url("video.brand", "b1", "music")
        expect(store.calls()).toEqual(["url video.brand.save video.brand/b1/music"])
    })

    it("rejects a call whose slot is unbound, and touches no store", async () => {
        const store = sampleBlockFiles()
        const files = filesVia(store, { read: "video.brand.get", write: null })
        await expect(files.upload("video.brand", "b1", "music", photo)).rejects.toThrow(FILE_UNBOUND)
        await expect(files.remove("video.brand", "b1", "music")).rejects.toThrow(FILE_UNBOUND)
        await expect(filesVia(store, { read: null, write: null }).url("video.brand", "b1", "music")).rejects.toThrow(FILE_UNBOUND)
        expect(store.calls()).toEqual([])
    })
})
