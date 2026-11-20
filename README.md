# pi-rex-btw

Ask a side question in a separate Pi chat without switching your main conversation. Requires Pi 1.6 and a Rex terminal with floating-layer support.

Load this checkout with `pi -e /path/to/pi-rex-btw` inside Rex. Disable `pi-btw` if it already registers `/btw`.

| Command | Action |
| --- | --- |
| `/btw <question>` | Open a float and send the first question. Keep typing in the float for follow-ups. |
| `/btw` | Open a blank chat. |
| `/btw ls` | Pick a thread from this Pi session, newest first. |
| `/tree` | Select a `btw` marker and choose **No summary** if prompted. Pi opens the float instead of switching branches. Pi's tree picker may stop an active response; use `/btw ls` to avoid that. |

Selecting a thread restores its live float or reopens the saved chat. Close the float or exit the child Pi to return to the main terminal. New chats use the parent’s model when no models are scoped, the only scoped model when there is one, or a picker when there are several.

The child Pi gets a text snapshot of the parent branch at launch. Reopening the chat does not refresh the snapshot. The child loads your normal Pi extensions, including model providers, with Pi's built-in MCP integration off. It starts with `read`, `grep`, `find`, and `ls`. Extensions can change the tool list or act on their own; this is not a sandbox.

Each child owns its transcript. The parent saves only a labelled link; older `pi-btw` branches remain unchanged in `/tree`. Keep the `.btw` directory next to the parent session file if you move or back up the session. Pi does not save a blank parent session until it contains a main-chat message.

## Release

If the package does not exist on npm yet, publish the first version manually with `npm publish --access public`. Then [configure npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for `maxpaulus43/pi-rex-btw` and `publish.yml`, with direct publishing allowed. No npm token is needed in GitHub Actions.

For later releases, bump `package.json` and push to `main`. The workflow runs `npm test`, publishes versions that aren't already on npm, and creates a matching GitHub release.
