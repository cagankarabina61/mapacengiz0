import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// tsconfig'deki "@/*" → "src/*" alias'ı vitest'e de tanıtılır.
// Olmadığında yalnızca `import type` biçimindeki alias'lı importlar çalışır
// (tip silindiği için), çalışma zamanı importları "Cannot find package" verir.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
