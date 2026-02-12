import { Client } from "ssh2";
import { readFile } from "fs/promises";
import { appLog } from "./app-logger";

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  authMethod: "key" | "password";
  keyPath?: string;
  password?: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function sshExec(
  config: SSHConfig,
  command: string,
  timeoutMs: number = 600000
): Promise<CommandResult> {
  const conn = new Client();

  appLog.debug("SSH", `Executing command on ${config.host}:${config.port} (timeout: ${Math.round(timeoutMs / 1000)}s)`, command);

  const connectConfig: Record<string, unknown> = {
    host: config.host,
    port: config.port,
    username: config.username,
    readyTimeout: 10000,
  };

  if (config.authMethod === "key" && config.keyPath) {
    appLog.debug("SSH", `Using key authentication from ${config.keyPath}`);
    try {
      const privateKey = await readFile(config.keyPath, "utf-8");
      connectConfig.privateKey = privateKey;
    } catch (err) {
      const msg = `Failed to read SSH key: ${err instanceof Error ? err.message : String(err)}`;
      appLog.error("SSH", msg);
      throw new Error(msg);
    }
  } else if (config.authMethod === "password" && config.password) {
    appLog.debug("SSH", "Using password authentication");
    connectConfig.password = config.password;
  } else {
    appLog.warn("SSH", `No valid auth configured (method: ${config.authMethod}, keyPath: ${config.keyPath || "none"})`);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      conn.end();
      const msg = `SSH command timed out after ${Math.round(timeoutMs / 1000)} seconds`;
      appLog.error("SSH", msg, command);
      reject(new Error(msg));
    }, timeoutMs);

    conn
      .on("ready", () => {
        appLog.debug("SSH", `Connected to ${config.host}`);
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timeout);
            conn.end();
            appLog.error("SSH", `Exec error: ${err.message}`, command);
            reject(err);
            return;
          }

          let stdout = "";
          let stderr = "";

          stream
            .on("data", (data: Buffer) => {
              stdout += data.toString();
            })
            .stderr.on("data", (data: Buffer) => {
              stderr += data.toString();
            });

          stream.on("close", (code: number) => {
            clearTimeout(timeout);
            conn.end();
            appLog.info(
              "SSH",
              `Command completed (exit code ${code}): ${command}`,
              [
                `$ ${command}`,
                "",
                stdout.trim() ? `STDOUT:\n${stdout.trim().slice(0, 1000)}` : "STDOUT: (empty)",
                stderr.trim() ? `\nSTDERR:\n${stderr.trim().slice(0, 1000)}` : "",
                "",
                `Exit code: ${code}`,
              ]
                .filter(Boolean)
                .join("\n")
            );
            resolve({ stdout, stderr, exitCode: code });
          });
        });
      })
      .on("error", (err) => {
        clearTimeout(timeout);
        appLog.error("SSH", `Connection error: ${err.message}`);
        reject(err);
      })
      .connect(connectConfig);
  });
}

export async function testSSHConnection(
  config: SSHConfig
): Promise<{ success: boolean; error?: string }> {
  appLog.info("SSH", `Testing connection to ${config.host}:${config.port} as ${config.username}`);
  try {
    const result = await sshExec(config, "echo ok");
    if (result.stdout.trim() === "ok") {
      appLog.info("SSH", "Connection test successful");
      return { success: true };
    }
    const msg = `Unexpected response: ${result.stdout}`;
    appLog.warn("SSH", msg);
    return { success: false, error: msg };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    appLog.error("SSH", `Connection test failed: ${msg}`);
    return { success: false, error: msg };
  }
}
