import { pipeline } from "stream/promises";
import { Readable } from "stream";


export async function readStdin() {
    const chunks = [];

    for await (const chunk of process.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString("utf-8");
}

export async function writeStdout(content) {
    if (typeof content !== "string") {
        throw new TypeError("writeStdout only accepts string");
    }

    await pipeline(Readable.from([content]), process.stdout);
}
