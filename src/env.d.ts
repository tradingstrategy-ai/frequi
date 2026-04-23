/* Provide Type for Vite's import.meta.env structure */
interface ImportMetaEnv extends Readonly<Record<string, string>> {
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly VITE_COMPARISON_API_BASE?: string;
  readonly VITE_ICHIV2_LS_HL_URL?: string;
  readonly VITE_ICHIV3_LS_HL_URL?: string;
  readonly VITE_NT_ICHIV3_SOLO_URL?: string;
  readonly VITE_NT_MULTI_STRATEGY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __COMMIT_HASH__: string;
