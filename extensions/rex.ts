import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ExtensionAPI, SessionEntry } from "@earendil-works/pi-coding-agent";

export interface Thread {
	id: string;
	question: string;
	title: string;
	provider: string;
	model: string;
}

export function readLink(entry: SessionEntry | undefined): Thread | undefined {
	if (entry?.type !== "custom_message" || entry.customType !== "rex-btw") return;
	const thread = entry.details as Partial<Thread> | undefined;
	if (typeof thread?.id === "string" && /^[\da-f-]{36}$/.test(thread.id) &&
		typeof thread.title === "string" && typeof thread.question === "string" &&
		typeof thread.provider === "string" && typeof thread.model === "string") return thread as Thread;
}

interface Target {
	session: string;
	block: string;
	directory: string;
	cwd: string;
}

interface Layer {
	layer_id: string;
	blocks: { block_id: string }[] | null;
}
interface View {
	windows: { window_id: string; layers: Layer[] }[];
}

export async function openFloat(pi: Pick<ExtensionAPI, "exec">, target: Target, thread: Thread) {
	async function rex<T>(...args: string[]): Promise<T> {
		const { code, stdout, stderr, killed } = await pi.exec("rex", args, { timeout: 5000 });
		if (killed || code !== 0) throw new Error(stderr.trim() || "Rex did not complete the request.");
		return JSON.parse(stdout) as T;
	}
	function api<T>(session: string, method: string, args: object = {}) {
		return rex<T>("api", "call", "-s", session, method, JSON.stringify(args));
	}

	const directory = join(target.directory, thread.id);
	const snapshot = join(directory, "snapshot.md");
	if (!existsSync(snapshot)) throw new Error("The saved BTW snapshot is missing.");
	const statePath = join(directory, "float.json");
	const view = await api<View>(target.session, "session.view");
	if (existsSync(statePath)) {
		const { session, layer_id, block_id } = JSON.parse(readFileSync(statePath, "utf8"));
		const present = session === target.session ||
			(await rex<{ sessions: { session_id: string }[] }>("ls", "--json")).sessions.some(s => s.session_id === session);
		const oldView = session === target.session ? view : present ? await api<View>(session, "session.view") : undefined;
		if (oldView?.windows.some(w => w.layers.some(l => l.layer_id === layer_id && l.blocks?.some(b => b.block_id === block_id)))) {
			await api(session, "session.set_layer_state", { layer_id, state: "normal", focus: true });
			return;
		}
	}

	const window = view.windows.find(w => w.layers.some(l => l.blocks?.some(b => b.block_id === target.block)));
	if (!window) throw new Error("Rex could not find the parent terminal.");
	const resumed = readdirSync(directory).some(file => file.endsWith(`_${thread.id}.jsonl`));
	const command = [process.execPath, resolve(process.argv[1]!), "--no-mcp",
		"--no-skills", "--no-prompt-templates", "--no-context-files", "--tools", "read,grep,find,ls",
		"--session-dir", directory, "--session-id", thread.id, "--append-system-prompt", snapshot];
	if (!resumed) {
		command.push("--provider", thread.provider, "--model", thread.model);
		// A leading space keeps Pi from treating an @-prefixed question as a file argument.
		if (thread.question) command.push("--", ` ${thread.question}`);
	}
	const created = await api<{ layer_id: string; block_ids: string[] }>(target.session, "session.new_layer", {
		window_id: window.window_id, bounds: [0.1, 0.1, 0.8, 0.8], focus: true,
		layout: { block: {
			flavor: "com.superlogical.terminal.shell", label: `BTW · ${thread.title}`,
			options: { shell: "none", cwd: target.cwd, command },
		} },
	});
	writeFileSync(statePath, JSON.stringify({ session: target.session, layer_id: created.layer_id, block_id: created.block_ids[0] }), { mode: 0o600 });
}
