import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 历史 Claude 工作区残留的子 worktree 复制品，不应计入主仓库 lint
    ".claude/**",
    // 由 Prisma 生成的客户端代码，不在我们的代码风格管控里
    "lib/generated/**",
  ]),
]);

export default eslintConfig;
