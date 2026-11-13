# Cammie

Free, browser-based CAM for hobby GRBL 1.1 CNC routers (built for the 3018).
Design in the browser, export `.nc` files, run them in gSender.

The full product and technical spec is in [SPEC.md](SPEC.md).

## Develop

```sh
npm install
npm run dev      # local dev server
npm test         # unit tests (Vitest)
npm run lint     # ESLint
npm run build    # type-check + production build into dist/
```

## Deploy (GitHub Pages)

Every push to `main` runs [the Pages workflow](.github/workflows/pages.yml): it tests,
builds, and publishes `dist/` to https://cammiecnc.com. To redeploy without a new commit,
run the workflow by hand from the Actions tab.

## Code layout

- `src/core/`: pure TypeScript domain logic (machine config, later geometry/CAM/G-code). No React.
- `src/persistence/`: localStorage access, versioned and failure-tolerant.
- `src/state/`: zustand stores.
- `src/ui/`: React components. `src/app/`: app shell and the small-screen gate.

Keep files under ~500 lines (ESLint warns past that) and split by responsibility.

## License

GPL-3.0. See [LICENSE](LICENSE).

The text tool's fonts are Google Fonts under the SIL Open Font License, bundled from the
[Fontsource](https://fontsource.org) packages (each package includes its licence).
