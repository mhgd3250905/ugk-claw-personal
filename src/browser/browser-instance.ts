export interface BrowserInstance {
	browserId: string;
	name: string;
	cdpHost: string;
	cdpPort: number;
	guiUrl?: string;
	profileLabel?: string;
	isDefault?: boolean;
}

export interface BrowserListResult {
	defaultBrowserId: string;
	browsers: BrowserInstance[];
}

