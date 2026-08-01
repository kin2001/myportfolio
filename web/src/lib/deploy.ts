import "server-only";

import type { MutationResult } from "@/lib/portfolio-types";

export async function triggerProductionBuild(): Promise<
  MutationResult<{ triggered: true }>
> {
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL?.trim();
  if (!hook) {
    return {
      ok: false,
      error: {
        code: "deploy_hook_not_configured",
        message: "The Vercel deploy hook is not configured.",
      },
    };
  }

  try {
    const response = await fetch(hook, { method: "POST", cache: "no-store" });
    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: "deploy_hook_failed",
          message: `Vercel rejected the deployment request (${response.status}).`,
        },
      };
    }
    return { ok: true, data: { triggered: true } };
  } catch {
    return {
      ok: false,
      error: {
        code: "deploy_hook_unavailable",
        message: "The deployment request could not reach Vercel.",
      },
    };
  }
}
