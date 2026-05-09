export class AgentBusyError extends Error {
	constructor(
		public readonly agentId: string,
		public readonly activeConversationId?: string,
	) {
		super(`Agent ${agentId} is currently busy`);
		this.name = "AgentBusyError";
	}
}
