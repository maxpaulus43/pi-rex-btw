import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import { openFloat, readLink } from "../extensions/rex.ts";

const thread = {
	id: "12345678-1234-1234-1234-123456789abc", title: "Question", question: "@not-a-file; $(not-a-command)",
	provider: "test-provider", model: "test-model",
};

test("opens in the parent window, focuses a live float, and resumes without resending the question", async t => {
	const directory = mkdtempSync(join(tmpdir(), "pi-rex-btw-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const child = join(directory, thread.id);
	mkdirSync(child);
	writeFileSync(join(child, "snapshot.md"), "parent snapshot");
	const target = { session: "block:parent", block: "block:parent", cwd: directory, directory };
	const layers = [{ layer_id: "layer:main", blocks: [{ block_id: target.block }] }];
	const launches: { window_id: string; layout: { block: { options: { shell: string; command: string[]; path_prepend: string[] } } } }[] = [];
	const focused: object[] = [];
	const pi = {
		async exec(program: string, args: string[]) {
			assert.equal(program, "rex");
			assert.deepEqual(args.slice(0, 3), ["api", "call", "-s"]);
			const payload = JSON.parse(args[5]!);
			let result;
			switch (args[4]) {
				case "session.view":
					result = { session_id: "session:test", windows: [{ window_id: "window:other", layers: [] }, { window_id: "window:parent", layers }] };
					break;
				case "session.new_layer":
					launches.push(payload);
					layers.push({ layer_id: "layer:btw", blocks: [{ block_id: "block:btw" }] });
					result = { layer_id: "layer:btw", block_ids: ["block:btw"] };
					break;
				case "session.set_layer_state":
					focused.push(payload);
					result = {};
					break;
				default:
					assert.fail(`Unexpected Rex command: ${args[4]}`);
			}
			return { code: 0, stdout: JSON.stringify(result), stderr: "", killed: false, truncated: false };
		},
	};

	await openFloat(pi, target, thread);
	assert.equal(JSON.parse(readFileSync(join(child, "float.json"), "utf8")).session, "session:test");
	const first = launches[0]!;
	assert.equal(first.window_id, "window:parent");
	assert.equal(first.layout.block.options.shell, "none");
	assert.deepEqual(first.layout.block.options.path_prepend, (process.env.PATH ?? "").split(delimiter).filter(Boolean));
	const command = first.layout.block.options.command;
	assert.ok(!command.includes("--no-extensions"));
	assert.ok(command.includes("--no-mcp"));
	assert.deepEqual(command.slice(command.indexOf("--models"), command.indexOf("--models") + 2), ["--models", ""]);
	assert.equal(command[command.indexOf("--tools") + 1], "read,grep,find,ls");
	assert.deepEqual(command.slice(-2), ["--", ` ${thread.question}`]);

	await openFloat(pi, target, thread);
	assert.equal(launches.length, 1);
	assert.deepEqual(focused, [{ layer_id: "layer:btw", state: "normal", focus: true }]);

	layers.pop();
	writeFileSync(join(child, `date_${thread.id}.jsonl`), "");
	await openFloat(pi, target, thread);
	const resumed = launches[1]!.layout.block.options.command;
	assert.deepEqual(resumed, command.slice(0, -6));
});

test("recognizes only safe thread links, not legacy entries or paths in marker details", () => {
	const entry = { id: "entry", parentId: null, timestamp: new Date().toISOString(), type: "custom_message" as const,
		customType: "rex-btw", content: thread.title, display: true, details: thread };
	assert.deepEqual(readLink(entry), thread);
	assert.equal(readLink({ ...entry, customType: "btw" }), undefined);
	assert.equal(readLink({ ...entry, details: { ...thread, id: "../../escape" } }), undefined);
});
