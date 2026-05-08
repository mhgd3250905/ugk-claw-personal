export interface BrowserTargetUsage {
	jsHeapUsedBytes?: number;
	jsHeapTotalBytes?: number;
	domNodes?: number;
	documents?: number;
	eventListeners?: number;
	available: boolean;
}

export interface BrowserTargetUsageReader {
	readUsage(webSocketDebuggerUrl: string): Promise<BrowserTargetUsage>;
}

export class CdpBrowserTargetUsageReader implements BrowserTargetUsageReader {
	constructor(private readonly timeoutMs = 1200) {}

	async readUsage(webSocketDebuggerUrl: string): Promise<BrowserTargetUsage> {
		const client = new CdpWebSocketClient(webSocketDebuggerUrl, this.timeoutMs);
		try {
			await client.open();
			const [heapUsage, domCounters] = await Promise.all([
				client.sendCommand("Runtime.getHeapUsage").catch(() => undefined),
				client.sendCommand("Memory.getDOMCounters").catch(() => undefined),
			]);
			return {
				available: Boolean(heapUsage || domCounters),
				jsHeapUsedBytes: readNumber((heapUsage as Record<string, unknown> | undefined)?.usedSize),
				jsHeapTotalBytes: readNumber((heapUsage as Record<string, unknown> | undefined)?.totalSize),
				domNodes: readNumber((domCounters as Record<string, unknown> | undefined)?.nodes),
				documents: readNumber((domCounters as Record<string, unknown> | undefined)?.documents),
				eventListeners: readNumber((domCounters as Record<string, unknown> | undefined)?.jsEventListeners),
			};
		} catch {
			return { available: false };
		} finally {
			client.close();
		}
	}
}

class CdpWebSocketClient {
	private readonly socket: WebSocket;
	private nextId = 1;
	private readonly pending = new Map<
		number,
		{
			resolve: (value: unknown) => void;
			reject: (error: Error) => void;
			timer: NodeJS.Timeout;
		}
	>();

	constructor(url: string, private readonly timeoutMs: number) {
		this.socket = new WebSocket(url);
		this.socket.addEventListener("message", (event) => this.handleMessage(event));
		this.socket.addEventListener("error", () => this.rejectAll(new Error("Chrome usage websocket failed")));
		this.socket.addEventListener("close", () => this.rejectAll(new Error("Chrome usage websocket closed")));
	}

	async open(): Promise<void> {
		if (this.socket.readyState === WebSocket.OPEN) {
			return;
		}
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error("Chrome usage websocket timeout")), this.timeoutMs);
			this.socket.addEventListener(
				"open",
				() => {
					clearTimeout(timer);
					resolve();
				},
				{ once: true },
			);
			this.socket.addEventListener(
				"error",
				() => {
					clearTimeout(timer);
					reject(new Error("Chrome usage websocket failed"));
				},
				{ once: true },
			);
		});
	}

	async sendCommand(method: string): Promise<unknown> {
		const id = this.nextId++;
		const payload = JSON.stringify({ id, method });
		return await new Promise<unknown>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`Chrome usage command timed out: ${method}`));
			}, this.timeoutMs);
			this.pending.set(id, { resolve, reject, timer });
			this.socket.send(payload);
		});
	}

	close(): void {
		try {
			this.socket.close();
		} catch {
			// Best effort cleanup only.
		}
	}

	private handleMessage(event: MessageEvent): void {
		const raw = typeof event.data === "string" ? event.data : "";
		if (!raw) {
			return;
		}
		let message: { id?: unknown; result?: unknown; error?: { message?: string } };
		try {
			message = JSON.parse(raw) as typeof message;
		} catch {
			return;
		}
		const id = readNumber(message.id);
		if (id === undefined) {
			return;
		}
		const pending = this.pending.get(id);
		if (!pending) {
			return;
		}
		this.pending.delete(id);
		clearTimeout(pending.timer);
		if (message.error) {
			pending.reject(new Error(message.error.message || "Chrome usage command failed"));
			return;
		}
		pending.resolve(message.result);
	}

	private rejectAll(error: Error): void {
		for (const [id, pending] of this.pending.entries()) {
			this.pending.delete(id);
			clearTimeout(pending.timer);
			pending.reject(error);
		}
	}
}

function readNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
