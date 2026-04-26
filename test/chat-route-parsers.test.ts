import assert from "node:assert/strict";
import test from "node:test";
import {
	parseChatMessageBody,
	parseOptionalPositiveInteger,
	parseQueueMessageBody,
} from "../src/routes/chat-route-parsers.js";

test("parseChatMessageBody preserves message text and trims asset refs", () => {
	const parsed = parseChatMessageBody({
		message: "  keep my spacing  ",
		assetRefs: [" asset-1 ", "asset-2"],
	});

	assert.equal(parsed.error, undefined);
	assert.equal(parsed.value?.message, "  keep my spacing  ");
	assert.deepEqual(parsed.value?.assetRefs, ["asset-1", "asset-2"]);
});

test("parseChatMessageBody rejects attachments with both text and base64", () => {
	const parsed = parseChatMessageBody({
		message: "read this",
		attachments: [
			{
				fileName: "note.txt",
				text: "hello",
				base64: "aGVsbG8=",
			},
		],
	});

	assert.equal(parsed.error, "attachments[0] cannot provide both text and base64");
});

test("parseQueueMessageBody validates queue mode", () => {
	const parsed = parseQueueMessageBody({
		conversationId: "manual:thread",
		message: "follow up",
		mode: "append" as never,
	});

	assert.equal(parsed.error, 'Field "mode" must be either "steer" or "followUp"');
});

test("parseOptionalPositiveInteger parses positive integer query values", () => {
	assert.deepEqual(parseOptionalPositiveInteger("80", "viewLimit"), { value: 80 });
	assert.deepEqual(parseOptionalPositiveInteger("0", "viewLimit"), {
		error: 'Field "viewLimit" must be a positive integer when provided',
	});
});
