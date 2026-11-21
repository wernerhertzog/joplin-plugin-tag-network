# Publishing Tag Network

The Joplin plugin directory imports eligible npm packages separately; an npm publication does not guarantee or immediately confirm a listing.

For a release, check the version in both `package.json` and `src/manifest.json`, test the built plugin in a Joplin development profile, commit the source, and run `npm test` and `npm run check:release`. The build generates a `.jpl` and accompanying metadata in `publish/`. Publish with `npm publish` using an authorized npm account. Keep the plugin ID unchanged across releases.

See the [Joplin publishing instructions](https://github.com/laurent22/joplin/blob/dev/packages/generator-joplin/generators/app/templates/GENERATOR_DOC.md#publishing-the-plugin).
