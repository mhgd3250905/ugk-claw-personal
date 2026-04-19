import { ConnRunner } from "./conn-runner.js";
import { ConnStore, type ConnDefinition } from "./conn-store.js";

export class ConnScheduler {
	private timer?: NodeJS.Timeout;
	private readonly running = new Set<string>();

	constructor(
		private readonly options: {
			store: ConnStore;
			runner: ConnRunner;
			pollIntervalMs?: number;
		},
	) {}

	start(): void {
		if (this.timer) {
			return;
		}
		const interval = this.options.pollIntervalMs ?? 15_000;
		this.timer = setInterval(() => {
			void this.tick();
		}, interval);
		this.timer.unref?.();
	}

	stop(): void {
		if (!this.timer) {
			return;
		}
		clearInterval(this.timer);
		this.timer = undefined;
	}

	async tick(now: Date = new Date()): Promise<void> {
		const dueConns = await this.options.store.due(now);
		for (const conn of dueConns) {
			if (this.running.has(conn.connId)) {
				continue;
			}
			this.running.add(conn.connId);
			void this.execute(conn, now).finally(() => {
				this.running.delete(conn.connId);
			});
		}
	}

	async runNow(connId: string, now: Date = new Date()): Promise<ConnDefinition | undefined> {
		const conn = await this.options.store.get(connId);
		if (!conn) {
			return undefined;
		}
		const result = await this.options.runner.run(conn);
		return await this.options.store.recordRun(connId, result, now);
	}

	private async execute(conn: ConnDefinition, now: Date): Promise<void> {
		const result = await this.options.runner.run(conn);
		await this.options.store.recordRun(conn.connId, result, now);
	}
}
