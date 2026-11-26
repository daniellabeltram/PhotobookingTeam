// npm run admin:hash  ->  prompts for a passphrase and prints ADMIN_PASSWORD_HASH (ADR 0003).
// Run with Node >= 22.18 (type stripping). The passphrase is never written to disk or printed.
import { createInterface } from "node:readline";
import { hashPassword } from "../netlify/lib/auth/password.ts";

const MIN_LENGTH = 14;

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      // piped input: read one line
      const rl = createInterface({ input: stdin });
      rl.once("line", (line) => {
        rl.close();
        resolve(line);
      });
      return;
    }
    process.stdout.write(question);
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch: string): void => {
      for (const c of ch) {
        if (c === "\r" || c === "\n" || c === "\u0004") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (c === "\u0003") process.exit(130);
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on("data", onData);
  });
}

const first = await promptHidden("New passphrase (at least 14 characters): ");
if (first.length < MIN_LENGTH) {
  console.error(`The passphrase must be at least ${MIN_LENGTH} characters.`);
  process.exit(1);
}
if (process.stdin.isTTY) {
  const second = await promptHidden("Type it again: ");
  if (second !== first) {
    console.error("The two passphrases don't match.");
    process.exit(1);
  }
}
const hash = await hashPassword(first);
console.log("\nSet this as ADMIN_PASSWORD_HASH (a secret) in your environment:\n");
console.log(hash);
