import assert from "node:assert/strict";
import test from "node:test";
import { getFeishuEventType, parseFeishuInboundMessage } from "../src/integrations/feishu/message-parser.js";

test("getFeishuEventType reads both top-level and nested event headers", () => {
	assert.equal(getFeishuEventType({ header: { event_type: "im.message.receive_v1" } }), "im.message.receive_v1");
	assert.equal(getFeishuEventType({ event: { header: { event_type: "im.message.receive_v1" } } }), "im.message.receive_v1");
	assert.equal(getFeishuEventType({ header: { event_type: 42 } }), undefined);
});

test("parseFeishuInboundMessage extracts text messages", () => {
	const incoming = parseFeishuInboundMessage({
		event: {
			message: {
				chat_id: "chat-1",
				message_id: "msg-1",
				message_type: "text",
				content: JSON.stringify({ text: "hello" }),
			},
		},
	});

	assert.deepEqual(incoming, {
		chatId: "chat-1",
		messageId: "msg-1",
		messageType: "text",
		text: "hello",
		resources: [],
	});
});

test("parseFeishuInboundMessage extracts sender open id when Feishu provides it", () => {
	const incoming = parseFeishuInboundMessage({
		event: {
			sender: {
				sender_id: {
					open_id: "ou-user",
				},
			},
			message: {
				chat_id: "chat-1",
				message_id: "msg-1",
				message_type: "text",
				content: JSON.stringify({ text: "hello" }),
			},
		},
	});

	assert.equal(incoming?.senderOpenId, "ou-user");
});

test("parseFeishuInboundMessage turns file and image content into resources", () => {
	assert.deepEqual(
		parseFeishuInboundMessage({
			message: {
				chat_id: "chat-2",
				message_id: "msg-file",
				message_type: "file",
				content: JSON.stringify({ file_key: "file-key", file_name: "report.pdf" }),
			},
		})?.resources,
		[
			{
				type: "file",
				resourceKey: "file-key",
				fileName: "report.pdf",
				mimeType: "application/octet-stream",
			},
		],
	);

	assert.deepEqual(
		parseFeishuInboundMessage({
			message: {
				chat_id: "chat-3",
				message_id: "msg-image",
				message_type: "image",
				content: JSON.stringify({ image_key: "image-key" }),
			},
		})?.resources,
		[
			{
				type: "image",
				resourceKey: "image-key",
				fileName: "image-key.png",
				mimeType: "image/png",
			},
		],
	);
});

test("parseFeishuInboundMessage tolerates invalid content JSON and rejects malformed message envelopes", () => {
	assert.deepEqual(parseFeishuInboundMessage({ message: { chat_id: "chat-4", message_id: "msg-bad", message_type: "text", content: "not-json" } }), {
		chatId: "chat-4",
		messageId: "msg-bad",
		messageType: "text",
		resources: [],
	});
	assert.equal(parseFeishuInboundMessage({ event: { message: { chat_id: "chat-5" } } }), undefined);
});
