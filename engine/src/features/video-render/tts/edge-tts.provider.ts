import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { TtsRetryable, type TtsProvider, type TtsRequest } from "./tts.provider";

const TIMEOUT_MS = 30_000;

/** Microsoft Edge read-aloud through `msedge-tts`: free, no key, Vietnamese neural voices. It throttles bursts, so TtsService paces the calls. */
export class EdgeTtsProvider implements TtsProvider {
  readonly id = "edge";
  private client: MsEdgeTTS | null = null;
  private voice = "";

  async synthesize(req: TtsRequest, signal: AbortSignal): Promise<Buffer> {
    try {
      const tts = await this.ready(req.voice);
      const pct = Math.round(req.ratePct);
      const { audioStream } = tts.toStream(req.text, { rate: `${pct >= 0 ? "+" : ""}${pct}%` });
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new TtsRetryable("edge tts timeout")), TIMEOUT_MS);
        const onAbort = () => reject(new Error("aborted"));
        signal.addEventListener("abort", onAbort, { once: true });
        const done = (fn: () => void) => {
          clearTimeout(timer);
          signal.removeEventListener("abort", onAbort);
          fn();
        };
        audioStream.on("data", (d: Buffer) => chunks.push(d));
        audioStream.on("end", () => done(resolve));
        audioStream.on("close", () => done(resolve));
        audioStream.on("error", (e: Error) => done(() => reject(new TtsRetryable(e.message))));
      });
      const audio = Buffer.concat(chunks);
      if (audio.length < 800) throw new TtsRetryable("edge tts returned no audio");
      return audio;
    } catch (e) {
      this.reset(); // a broken socket is rebuilt on the next call
      throw e instanceof TtsRetryable || (e instanceof Error && e.message === "aborted") ? e : new TtsRetryable(e instanceof Error ? e.message : String(e));
    }
  }

  close(): void {
    this.reset();
  }

  private async ready(voice: string): Promise<MsEdgeTTS> {
    if (!this.client || this.voice !== voice) {
      this.reset();
      const client = new MsEdgeTTS();
      await client.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      this.client = client;
      this.voice = voice;
    }
    return this.client;
  }

  private reset(): void {
    try {
      this.client?.close();
    } catch {
      /* already closed */
    }
    this.client = null;
    this.voice = "";
  }
}
