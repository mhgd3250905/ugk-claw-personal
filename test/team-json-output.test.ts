import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stripMarkdownFence, repairJson } from "../src/team/json-output.js";

describe("team json output helpers", () => {
	it("strips markdown JSON fences", () => {
		assert.equal(stripMarkdownFence("```json\n{\"ok\":true}\n```"), "{\"ok\":true}");
	});

	it("repairs unescaped quotes inside JSON string values", () => {
		const result = repairJson('{"msg":"Domain contains "med" here"}') as { msg: string };
		assert.equal(result.msg, 'Domain contains "med" here');
	});
});
