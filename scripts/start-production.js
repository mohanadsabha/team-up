const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const serverPath = path.join(__dirname, "..", "dist", "server.js");

if (!fs.existsSync(serverPath)) {
  console.log("[start] dist/server.js not found — running build...");
  execSync("npm run build", { stdio: "inherit", env: process.env });
}

require(serverPath);
