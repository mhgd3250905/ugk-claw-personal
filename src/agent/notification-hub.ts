export interface NotificationBroadcastEvent {
	notificationId?: string;
	activityId?: string;
	conversationId?: string;
	source: string;
	sourceId: string;
	runId?: string;
	kind: string;
	title: string;
	createdAt: string;
}

export interface NotificationHubSubscription {
	unsubscribe(): void;
}

type NotificationHubListener = (event: NotificationBroadcastEvent) => void;

export class NotificationHub {
	private readonly listeners = new Set<NotificationHubListener>();

	subscribe(listener: NotificationHubListener): NotificationHubSubscription {
		this.listeners.add(listener);
		return {
			unsubscribe: () => {
				this.listeners.delete(listener);
			},
		};
	}

	broadcast(event: NotificationBroadcastEvent): void {
		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch {
				// Notification delivery is best-effort; a dead subscriber must not poison the hub.
			}
		}
	}
}
