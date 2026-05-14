export function stripMarkdownFence(raw: string): string {
	let value = raw.trim();
	if (value.startsWith("```")) {
		const firstNewline = value.indexOf("\n");
		if (firstNewline >= 0) value = value.slice(firstNewline + 1);
	}
	if (value.endsWith("```")) {
		value = value.slice(0, value.lastIndexOf("```"));
	}
	return value.trim();
}

export function repairJson(raw: string): unknown {
	try { return JSON.parse(raw); } catch { /* try character-level repair */ }

	const result: string[] = [];
	let inString = false;
	let escaped = false;
	for (let index = 0; index < raw.length; index++) {
		const ch = raw[index];
		if (escaped) {
			result.push(ch);
			escaped = false;
			continue;
		}
		if (ch === "\\" && inString) {
			result.push(ch);
			escaped = true;
			continue;
		}
		if (ch === "\"") {
			if (!inString) {
				inString = true;
				result.push(ch);
				continue;
			}

			const rest = raw.slice(index + 1);
			const nextMeaningful = rest.match(/^\s*([:,\}\]\n])/);
			if (nextMeaningful) {
				inString = false;
				result.push(ch);
			} else {
				result.push("\\\"");
			}
			continue;
		}
		result.push(ch);
	}

	try { return JSON.parse(result.join("")); } catch { /* give up */ }

	throw new Error("JSON repair failed");
}
