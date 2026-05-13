export type ArtifactExpectedKind =
	| "auto"
	| "file"
	| "web"
	| "xlsx"
	| "pdf"
	| "csv"
	| "markdown";

export interface ArtifactDeliveryConfig {
	enabled: boolean;
	expectedKind: ArtifactExpectedKind;
	repairMaxAttempts: number;
	contract?: ArtifactContract;
	contractGeneratedAt?: string;
	contractSource?: "manual" | "agent" | "rule" | "fallback";
	contractStatus?: "valid" | "invalid" | "missing";
}

export interface ArtifactContract {
	version: 1;
	expectedKind: ArtifactExpectedKind;
	requiredOutputs: ArtifactRequiredOutput[];
	checks: ArtifactCheck[];
	repairPolicy: {
		maxAttempts: number;
	};
}

export interface ArtifactRequiredOutput {
	kind: "file" | "web";
	target: "artifact_public";
	format?:
		| "any"
		| "html"
		| "xlsx"
		| "pdf"
		| "csv"
		| "markdown"
		| "json"
		| "image";
	minCount?: number;
	allowEmpty?: boolean;
	entryPath?: string;
	description?: string;
}

export type ArtifactCheckType =
	| "artifact_public_not_empty"
	| "file_exists"
	| "file_not_empty"
	| "format_matches"
	| "xlsx_can_open"
	| "pdf_header_valid"
	| "web_entry_exists"
	| "html_local_assets_exist"
	| "no_container_paths"
	| "no_file_url"
	| "no_sensitive_files";

export interface ArtifactCheck {
	type: ArtifactCheckType;
}

const ALLOWED_KINDS: readonly ArtifactExpectedKind[] = [
	"auto",
	"file",
	"web",
	"xlsx",
	"pdf",
	"csv",
	"markdown",
];

const ALLOWED_CHECK_TYPES: readonly ArtifactCheckType[] = [
	"artifact_public_not_empty",
	"file_exists",
	"file_not_empty",
	"format_matches",
	"xlsx_can_open",
	"pdf_header_valid",
	"web_entry_exists",
	"html_local_assets_exist",
	"no_container_paths",
	"no_file_url",
	"no_sensitive_files",
];

const FORBIDDEN_FIELD_NAMES = ["command", "bash", "script", "shell"];

export function buildDefaultArtifactContract(input: {
	expectedKind: ArtifactExpectedKind;
	repairMaxAttempts: number;
}): ArtifactContract {
	const { expectedKind, repairMaxAttempts } = input;

	switch (expectedKind) {
		case "auto":
			return {
				version: 1,
				expectedKind: "auto",
				requiredOutputs: [
					{
						kind: "file",
						target: "artifact_public",
						format: "any",
						minCount: 1,
						allowEmpty: false,
					},
				],
				checks: [
					{ type: "artifact_public_not_empty" },
					{ type: "file_not_empty" },
					{ type: "no_sensitive_files" },
					{ type: "no_container_paths" },
					{ type: "no_file_url" },
				],
				repairPolicy: { maxAttempts: repairMaxAttempts },
			};

		case "web":
			return {
				version: 1,
				expectedKind: "web",
				requiredOutputs: [
					{
						kind: "web",
						target: "artifact_public",
						format: "html",
						entryPath: "index.html",
						minCount: 1,
						allowEmpty: false,
					},
				],
				checks: [
					{ type: "artifact_public_not_empty" },
					{ type: "web_entry_exists" },
					{ type: "html_local_assets_exist" },
					{ type: "no_sensitive_files" },
					{ type: "no_container_paths" },
					{ type: "no_file_url" },
				],
				repairPolicy: { maxAttempts: repairMaxAttempts },
			};

		case "xlsx":
			return {
				version: 1,
				expectedKind: "xlsx",
				requiredOutputs: [
					{
						kind: "file",
						target: "artifact_public",
						format: "xlsx",
						minCount: 1,
						allowEmpty: false,
					},
				],
				checks: [
					{ type: "artifact_public_not_empty" },
					{ type: "file_not_empty" },
					{ type: "format_matches" },
					{ type: "xlsx_can_open" },
					{ type: "no_sensitive_files" },
				],
				repairPolicy: { maxAttempts: repairMaxAttempts },
			};

		case "pdf":
			return {
				version: 1,
				expectedKind: "pdf",
				requiredOutputs: [
					{
						kind: "file",
						target: "artifact_public",
						format: "pdf",
						minCount: 1,
						allowEmpty: false,
					},
				],
				checks: [
					{ type: "artifact_public_not_empty" },
					{ type: "file_not_empty" },
					{ type: "format_matches" },
					{ type: "pdf_header_valid" },
					{ type: "no_sensitive_files" },
				],
				repairPolicy: { maxAttempts: repairMaxAttempts },
			};

		case "csv":
			return {
				version: 1,
				expectedKind: "csv",
				requiredOutputs: [
					{
						kind: "file",
						target: "artifact_public",
						format: "csv",
						minCount: 1,
						allowEmpty: false,
					},
				],
				checks: [
					{ type: "artifact_public_not_empty" },
					{ type: "file_not_empty" },
					{ type: "format_matches" },
					{ type: "no_sensitive_files" },
				],
				repairPolicy: { maxAttempts: repairMaxAttempts },
			};

		case "markdown":
			return {
				version: 1,
				expectedKind: "markdown",
				requiredOutputs: [
					{
						kind: "file",
						target: "artifact_public",
						format: "markdown",
						minCount: 1,
						allowEmpty: false,
					},
				],
				checks: [
					{ type: "artifact_public_not_empty" },
					{ type: "file_not_empty" },
					{ type: "format_matches" },
					{ type: "no_sensitive_files" },
				],
				repairPolicy: { maxAttempts: repairMaxAttempts },
			};

		case "file":
			return {
				version: 1,
				expectedKind: "file",
				requiredOutputs: [
					{
						kind: "file",
						target: "artifact_public",
						format: "any",
						minCount: 1,
						allowEmpty: false,
					},
				],
				checks: [
					{ type: "artifact_public_not_empty" },
					{ type: "file_not_empty" },
					{ type: "no_sensitive_files" },
				],
				repairPolicy: { maxAttempts: repairMaxAttempts },
			};
	}
}

export function validateArtifactContract(
	value: unknown,
):
	| { ok: true; contract: ArtifactContract }
	| { ok: false; errors: string[] } {
	const errors: string[] = [];

	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return { ok: false, errors: ["Contract must be an object"] };
	}

	const obj = value as Record<string, unknown>;

	if (obj.version !== 1) {
		errors.push("version must be 1");
	}

	if (!ALLOWED_KINDS.includes(obj.expectedKind as ArtifactExpectedKind)) {
		errors.push(
			`expectedKind must be one of: ${ALLOWED_KINDS.join(", ")}`,
		);
	}

	if (!Array.isArray(obj.requiredOutputs)) {
		errors.push("requiredOutputs must be an array");
	} else if (obj.requiredOutputs.length > 5) {
		errors.push("requiredOutputs must have at most 5 entries");
	} else {
		for (let i = 0; i < obj.requiredOutputs.length; i += 1) {
			const output = obj.requiredOutputs[i] as Record<string, unknown>;
			if (output.target !== "artifact_public") {
				errors.push(
					`requiredOutputs[${i}].target must be "artifact_public"`,
				);
			}
			if (output.entryPath !== undefined) {
				const normalized = normalizeArtifactRelativePath(
					output.entryPath as string,
				);
				if (!normalized) {
					errors.push(
						`requiredOutputs[${i}].entryPath is not a safe relative path`,
					);
				}
			}
		}
	}

	if (!Array.isArray(obj.checks)) {
		errors.push("checks must be an array");
	} else if (obj.checks.length > 20) {
		errors.push("checks must have at most 20 entries");
	} else {
		for (const check of obj.checks as Array<Record<string, unknown>>) {
			if (
				!ALLOWED_CHECK_TYPES.includes(check.type as ArtifactCheckType)
			) {
				errors.push(`Unknown check type: ${String(check.type)}`);
			}
		}
	}

	const repairPolicy = obj.repairPolicy as Record<string, unknown> | undefined;
	if (!repairPolicy || typeof repairPolicy !== "object") {
		errors.push("repairPolicy must be an object");
	} else {
		const maxAttempts = repairPolicy.maxAttempts;
		if (
			typeof maxAttempts !== "number" ||
			!Number.isInteger(maxAttempts) ||
			maxAttempts < 0 ||
			maxAttempts > 3
		) {
			errors.push("repairPolicy.maxAttempts must be an integer 0-3");
		}
	}

	for (const forbidden of FORBIDDEN_FIELD_NAMES) {
		if (forbidden in obj) {
			errors.push(
				`Contract must not contain field "${forbidden}"`,
			);
		}
	}

	if (errors.length > 0) {
		return { ok: false, errors };
	}

	return { ok: true, contract: obj as unknown as ArtifactContract };
}

export function normalizeArtifactRelativePath(
	input: string,
): string | undefined {
	const trimmed = String(input || "").trim();
	if (!trimmed) return undefined;
	const value = trimmed.replace(/\\/g, "/");
	if (value.startsWith("/")) return undefined;
	const segments = value.split("/");
	if (
		segments.some(
			(segment) =>
				!segment ||
				segment === "." ||
				segment === ".." ||
				segment.startsWith("."),
		)
	) {
		return undefined;
	}
	return segments.join("/");
}

export function normalizeArtifactDeliveryInput(
	input: unknown,
): ArtifactDeliveryConfig {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		return { enabled: false, expectedKind: "auto", repairMaxAttempts: 2 };
	}
	const obj = input as Record<string, unknown>;

	const enabled = obj.enabled === true;
	const rawKind = String(obj.expectedKind ?? "auto");
	const expectedKind = ALLOWED_KINDS.includes(rawKind as ArtifactExpectedKind)
		? (rawKind as ArtifactExpectedKind)
		: "auto";
	const rawAttempts = Number(obj.repairMaxAttempts ?? 2);
	const repairMaxAttempts =
		Number.isInteger(rawAttempts) && rawAttempts >= 0 && rawAttempts <= 3
			? rawAttempts
			: 2;

	return { enabled, expectedKind, repairMaxAttempts };
}
