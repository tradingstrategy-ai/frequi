/* Provide Type for Vite's import.meta.env structure */
interface ImportMetaEnv extends Readonly<Record<string, string>> {
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly VITE_COMPARISON_API_BASE?: string;
  readonly VITE_KNOWN_BOT_HOSTNAMES?: string;
  readonly VITE_KNOWN_BOT_PORTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __COMMIT_HASH__: string;
