import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ali-oss 内部依赖 proxy-agent / urllib 等 optional 模块，打包器静态分析会
  // 触发 "Module not found: proxy-agent"。它是纯服务端 SDK，标记为外部依赖
  // （运行时 require，不进 bundle）即可。
  serverExternalPackages: ["ali-oss"],

  // 沙箱内 FUSE 挂载不允许 unlink/rmdir，导致 Next 的 .next/export 清理报错。
  // 通过 NEXT_BUILD_DIR 环境变量把构建目录引到 /tmp/zupu-next（仅在沙箱里设定），
  // 普通开发与生产部署仍然走默认 .next。
  ...(process.env.NEXT_BUILD_DIR
    ? { distDir: process.env.NEXT_BUILD_DIR }
    : {}),
};

export default nextConfig;
