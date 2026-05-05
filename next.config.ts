import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 沙箱内 FUSE 挂载不允许 unlink/rmdir，导致 Next 的 .next/export 清理报错。
  // 通过 NEXT_BUILD_DIR 环境变量把构建目录引到 /tmp/zupu-next（仅在沙箱里设定），
  // 普通开发与生产部署仍然走默认 .next。
  ...(process.env.NEXT_BUILD_DIR
    ? { distDir: process.env.NEXT_BUILD_DIR }
    : {}),
};

export default nextConfig;
