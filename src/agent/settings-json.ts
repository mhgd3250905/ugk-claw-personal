export function readJsonScalarSetting(content: string, key: string): string | undefined {
	const parsed = parseJsonObject(stripJsonComments(content));
	const value = findTopLevelJsonScalarValue(parsed, key);
	return stringifyJsonScalarValue(value);
}

export function readNestedJsonScalarSetting(content: string, key: string): string | undefined {
	const parsed = parseJsonObject(stripJsonComments(content));
	const value = findNestedJsonScalarValue(parsed, key);
	return stringifyJsonScalarValue(value);
}

export function parseJsonSettingsObject(content: string): Record<string, unknown> {
	const parsed = parseJsonObject(stripJsonComments(content));
	return parsed && typeof parsed === "object" && !Array.isArray(parsed)
		? (parsed as Record<string, unknown>)
		: {};
}

function stringifyJsonScalarValue(value: unknown): string | undefined {
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}
	return undefined;
}

export function replaceOrInsertJsonStringSetting(content: string, key: string, value: string): string {
	const match = findActiveJsonStringProperty(content, key);
	const escapedValue = JSON.stringify(value);
	if (match) {
		return `${content.slice(0, match.valueStart)}${escapedValue}${content.slice(match.valueEnd)}`;
	}

	const closingBraceIndex = findLastObjectClosingBrace(content);
	const propertyLine = `  "${key}": ${escapedValue}`;
	if (closingBraceIndex < 0) {
		return `{\n${propertyLine}\n}`;
	}
	const before = content.slice(0, closingBraceIndex).trimEnd();
	const after = content.slice(closingBraceIndex);
	const separator = before.endsWith("{") ? "\n" : ",\n";
	return `${before}${separator}${propertyLine}\n${after}`;
}

function parseJsonObject(content: string): unknown {
	if (!content.trim()) {
		return {};
	}
	try {
		return JSON.parse(content);
	} catch {
		return {};
	}
}

function findTopLevelJsonScalarValue(value: unknown, key: string): unknown {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	return (value as Record<string, unknown>)[key];
}

function findNestedJsonScalarValue(value: unknown, key: string): unknown {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	if (Object.prototype.hasOwnProperty.call(value, key)) {
		return (value as Record<string, unknown>)[key];
	}
	for (const child of Object.values(value as Record<string, unknown>)) {
		const found = findNestedJsonScalarValue(child, key);
		if (found !== undefined) {
			return found;
		}
	}
	return undefined;
}

function findActiveJsonStringProperty(content: string, key: string): { valueStart: number; valueEnd: number } | undefined {
	const stripped = stripJsonComments(content);
	const propertyPattern = new RegExp(`("${escapeRegExp(key)}"\\s*:\\s*)("[^"\\\\]*(?:\\\\.[^"\\\\]*)*")`);
	const match = propertyPattern.exec(stripped);
	if (!match || match.index === undefined) {
		return undefined;
	}
	const prefixLength = match[1]?.length ?? 0;
	const valueLength = match[2]?.length ?? 0;
	const valueStart = match.index + prefixLength;
	return {
		valueStart,
		valueEnd: valueStart + valueLength,
	};
}

function stripJsonComments(content: string): string {
	let result = "";
	let inString = false;
	let escaped = false;
	let inLineComment = false;
	let inBlockComment = false;

	for (let index = 0; index < content.length; index += 1) {
		const char = content[index]!;
		const next = content[index + 1];

		if (inLineComment) {
			if (char === "\r" || char === "\n") {
				inLineComment = false;
				result += char;
			} else {
				result += " ";
			}
			continue;
		}

		if (inBlockComment) {
			if (char === "*" && next === "/") {
				result += "  ";
				index += 1;
				inBlockComment = false;
			} else {
				result += char === "\r" || char === "\n" ? char : " ";
			}
			continue;
		}

		if (inString) {
			result += char;
			if (escaped) {
				escaped = false;
			} else if (char === "\\") {
				escaped = true;
			} else if (char === "\"") {
				inString = false;
			}
			continue;
		}

		if (char === "\"") {
			inString = true;
			result += char;
			continue;
		}

		if (char === "/" && next === "/") {
			result += "  ";
			index += 1;
			inLineComment = true;
			continue;
		}

		if (char === "/" && next === "*") {
			result += "  ";
			index += 1;
			inBlockComment = true;
			continue;
		}

		result += char;
	}

	return result;
}

function findLastObjectClosingBrace(content: string): number {
	const stripped = stripJsonComments(content);
	for (let index = stripped.length - 1; index >= 0; index -= 1) {
		if (stripped[index] === "}") {
			return index;
		}
	}
	return -1;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
