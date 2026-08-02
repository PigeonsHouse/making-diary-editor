import type {NextConfig} from "next";

const config: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer", "bullmq", "ioredis", "postgres"],
};

export default config;
