const { spawn } = require("child_process");
const fs = require("fs");
const path = "C:\\Users\\Administrator\\cloudflared.exe";

console.log("Starting cloudflared from:", path);
console.log(
  "File exists:",
  fs.existsSync(path),
  "Size:",
  fs.existsSync(path) ? fs.statSync(path).size : 0,
);

const cf = spawn(
  path,
  ["tunnel", "--url", "http://localhost:8870", "--no-autoupdate"],
  { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
);

let allOutput = "";
let found = false;

function onData(data) {
  const line = data.toString();
  allOutput += line;
  process.stderr.write(line);
  const m = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m && !found) {
    found = true;
    console.log("\n\nTUNNEL_URL=" + m[0]);
    fs.writeFileSync("C:\\Users\\Administrator\\tunnel_url.txt", m[0]);
  }
}

cf.stdout.on("data", onData);
cf.stderr.on("data", onData);
cf.on("error", (e) => {
  console.error("spawn error:", e.message);
  process.exit(1);
});
cf.on("close", (code) => {
  console.log("cloudflared exited:", code);
});

setTimeout(() => {
  if (!found) {
    console.log("TIMEOUT - no tunnel URL. Output:");
    console.log(allOutput.slice(0, 3000));
  }
}, 30000);
