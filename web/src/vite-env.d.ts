interface ImportMetaEnv {
  /** Where the tuning API answers. Defaults to /v1/tuning/ on this origin. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** A guide page and its fenced blocks, rendered at build time. */
declare module "*.md?guide" {
  const page: { source: string; code: Record<string, string> };
  export default page;
}

declare module "virtual:guide-code";
