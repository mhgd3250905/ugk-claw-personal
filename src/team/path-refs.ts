import path from "node:path";

const urlLike = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export function validateRunRef(ref: string): true {
	if (!ref || ref.trim() !== ref || path.isAbsolute(ref) || urlLike.test(ref) || ref.includes("\\")) {
		throw new Error(`invalid run ref: ${ref}`);
	}
	const normalized = path.posix.normalize(ref);
	if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
		throw new Error(`invalid run ref: ${ref}`);
	}
	return true;
}

export function resolveRunRef(runRoot: string, ref: string): string {
	validateRunRef(ref);
	const resolved = path.resolve(runRoot, ref);
	const root = path.resolve(runRoot);
	if (resolved !== root && !resolved.startsWith(root + path.sep)) {
		throw new Error(`invalid run ref: ${ref}`);
	}
	return resolved;
}
