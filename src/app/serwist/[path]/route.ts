import { createSerwistRoute } from "@serwist/turbopack";

const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "harmonic-compass-v1";

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    additionalPrecacheEntries: [{ url: "/~offline", revision }],
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
  },
);
