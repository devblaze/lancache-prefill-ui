import { appLog } from "./app-logger";

export interface HealthCheckResult {
  reachable: boolean;
  responseTimeMs?: number;
  statusCode?: number;
  error?: string;
}

export async function checkLancacheHealth(
  serverUrl: string
): Promise<HealthCheckResult> {
  appLog.info("Health", `Checking lancache at ${serverUrl}`);
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(serverUrl, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "manual",
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;

    appLog.info(
      "Health",
      `Lancache reachable: status=${response.status}, time=${responseTimeMs}ms`
    );

    return {
      reachable: true,
      responseTimeMs,
      statusCode: response.status,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    appLog.error("Health", `Lancache unreachable: ${msg}`);
    return {
      reachable: false,
      responseTimeMs: Date.now() - startTime,
      error: msg,
    };
  }
}
