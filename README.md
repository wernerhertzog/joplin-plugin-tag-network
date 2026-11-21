# Tag Network for Joplin

Tag Network adds a panel to Joplin desktop to explore how tags are used together. Two tags are connected when they appear on the same note; a thicker line and a shorter preferred distance represent more shared notes. More frequently used tags have larger names and dots. Dot color runs from blue (fewer notes) through yellow to red (more notes), using a logarithmic scale relative to the largest displayed count. The graph first arranges tags by their connections, then moves labels apart to prevent overlap. Layout and distances are approximate, so spacing and other connections also affect the final positions.

## Install

Requires Joplin desktop 3.7.22 or newer. Once the plugin appears in Joplin's plugin directory, open **Settings / Preferences → Plugins**, search for **Tag Network**, and install it. Publication to npm does not mean the directory listing is immediate or guaranteed.

To install from a file, download the `.jpl` from a release or build it locally. Building requires Node.js 18 or newer and the `tar` command. From this directory run:

```sh
npm run build
npm test
```

In Joplin, open **Settings / Preferences → Plugins**, click the gear-shaped **Plugin tools** button, choose **Install from file**, and select the downloaded `.jpl` or the local `publish/tag-network.jpl`. Restart Joplin when prompted. This is a separate plugin and can be installed alongside Tag Cloud.

## Use

- Open or hide the panel with **View → Toggle Tag Network**. Use **View → Change application layout** to give it more space.
- The default is **All tags**, including tags with no notes. Choose **Most used** and enter a number to show the most frequently used tags. Ties are ordered by title.
- Check **Hide disconnected** to hide tags without links to another displayed tag. Filtering happens after the most-used limit, so a tag connected only to tags outside the selection is considered disconnected. Disconnected tags start around the outside of the graph.
- Scroll or use **+** and **−** to zoom; drag the background to pan, or drag a tag to move it. The initial view keeps names readable, so a large graph may extend beyond the panel. **Fit** shows the whole graph, potentially at a smaller text size.
- Use **Tag text size** to make all tag names larger or smaller while retaining their relative sizes; the choice is remembered. The control is disabled when names are hidden.
- Uncheck **Show dots** for a text-only graph, or uncheck **Show tag names** for a dots-only graph. The settings are remembered. At least one of the two stays visible.
- Hover over a tag or dot to see its name and note count and up to five most frequent connections, including connections to tags outside the current selection. Click a tag to open its notes in Joplin. The **Browse displayed tags** list provides keyboard-accessible buttons with the same action and hover text.
- The panel refreshes after synchronization and, when visible, after changing notes if the data is over 30 seconds old. Use the refresh button to update immediately.

Large networks need more screen space and can take time to load and render, particularly when many tags appear together on the same notes. Restrict the number of tags or hide disconnected tags to reduce clutter; the graph can be zoomed and panned. Loading uses Joplin's data API and reads each tag's notes, so the first load may take time for large libraries. Counts and connections are based on the notes returned by that API. No notes or tags are modified, and data is not sent to an external service.

## License

MIT. See [LICENSE](LICENSE).
