import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  // NOT: globalIgnores ESLint'in yerleşik varsayılanlarını da değiştirdiği için
  // node_modules açıkça yazılmalıdır — aksi halde `npm run lint` bağımlılıkları
  // tarayıp 200 binden fazla alakasız uyarı üretiyor ve gerçek hatalar kayboluyor.
  globalIgnores([
    "**/node_modules/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Üretilen / veri klasörleri:
    "uploads/**",
    "prisma/migrations/**",
  ]),
]);

export default eslintConfig;
