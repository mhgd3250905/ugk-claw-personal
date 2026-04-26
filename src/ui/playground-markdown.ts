import { Marked, type Tokens } from "marked";

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
	return escapeHtml(value).replace(/`/g, "&#96;");
}

function isSafeHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

const playgroundMarkdownParser = new Marked({
	gfm: true,
	breaks: false,
	async: false,
	renderer: {
		html({ text }: Tokens.HTML | Tokens.Tag): string {
			return escapeHtml(text);
		},
		link({ href, title, text }: Tokens.Link): string {
			if (!isSafeHttpUrl(href)) {
				return escapeHtml(text);
			}
			const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : "";
			return `<a href="${escapeAttribute(href)}"${titleAttribute} target="_blank" rel="noreferrer noopener">${escapeHtml(text)}</a>`;
		},
	},
});

export function renderPlaygroundMarkdown(source: string): string {
	const normalized = String(source ?? "").replace(/\r\n?/g, "\n").trim();
	if (!normalized) {
		return "<p></p>";
	}

	const rendered = playgroundMarkdownParser.parse(normalized, { async: false });
	return String(rendered).trim() || "<p></p>";
}
