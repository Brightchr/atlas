/** Injected by vite.config.ts `define` — the exact pinned sql.js version. */
declare const __SQL_JS_VERSION__: string;

/** Vite `?url` asset import: the file is emitted as a hashed asset and the
 * module resolves to its URL (used for the vendored exercise catalog JSON). */
declare module '*.json?url' {
  const url: string;
  export default url;
}
