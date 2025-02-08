/*******************************************************
 * deploy.js
 *
 * 1) Run the server:
 *    node deploy.js
 *
 * 2) POST to http://localhost:3000/deploy with JSON:
 *    { "url": "https://some-site-with-html" }
 *
 * The server will:
 *   - Fetch the HTML
 *   - Save as build/index.html
 *   - Zip build/ -> site.zip
 *   - Deploy to Netlify (using .env credentials)
 *   - Return ONLY a success message + final link in JSON
 *******************************************************/

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { execSync } = require("child_process");

// 1️⃣ Netlify credentials
const NETLIFY_AUTH_TOKEN = process.env.NETLIFY_AUTH_TOKEN;
const NETLIFY_SITE_ID = process.env.NETLIFY_SITE_ID;

if (!NETLIFY_AUTH_TOKEN) {
  console.error("❌ ERROR: Missing NETLIFY_AUTH_TOKEN in .env");
  process.exit(1);
}

// Determine Netlify endpoint (existing site vs. new site)
const netlifyEndpoint = NETLIFY_SITE_ID
  ? `https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/deploys`
  : "https://api.netlify.com/api/v1/sites";

// 2️⃣ Set up Express app
const app = express();
const PORT = 3000;

// Use JSON parsing
app.use(express.json());

// 3️⃣ POST /deploy: Expects { "url": "<HTML URL>" }
app.post("/deploy", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "No 'url' provided in JSON body." });
  }

  console.log(`\n🌍 Fetching HTML from: ${url}`);

  // Define paths
  const baseFolder = __dirname;
  const buildFolder = path.join(baseFolder, "build");
  const indexFile = path.join(buildFolder, "index.html");
  const zipFile = path.join(baseFolder, "site.zip");

  try {
    // 4️⃣ Fetch the HTML
    const response = await axios.get(url);
    if (typeof response.data !== "string") {
      return res
        .status(400)
        .json({ error: "The requested URL did not return raw HTML content." });
    }

    // Ensure build folder exists
    fs.ensureDirSync(buildFolder);

    // 5️⃣ Save HTML to build/index.html
    fs.writeFileSync(indexFile, response.data, "utf8");
    console.log(`✅ HTML saved to: ${indexFile}`);

    // Remove old site.zip if it exists (optional)
    if (fs.existsSync(zipFile)) {
      fs.unlinkSync(zipFile);
    }

    // 6️⃣ Zip the build folder
    console.log("📦 Zipping build folder...");
    execSync(`zip -r "${zipFile}" "${buildFolder}"`, { stdio: "inherit" });
    console.log(`✅ site.zip created at: ${zipFile}`);

    // Read the zip into a buffer
    const zipBuffer = fs.readFileSync(zipFile);

    // 7️⃣ Deploy to Netlify
    console.log("🚀 Deploying ZIP to Netlify...");
    const deployResp = await axios.post(netlifyEndpoint, zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        Authorization: `Bearer ${NETLIFY_AUTH_TOKEN}`,
      },
    });

    const data = deployResp.data;
    console.log("\n🎉 Deployment success!");
    console.log("Netlify response data:", data);

    // 8️⃣ Send ONLY a success message + final link
    return res.json({
      message: "Deployment success!",
      link: data.deploy_url || data.url || null
    });

  } catch (error) {
    console.error("❌ ERROR deploying:", error.response?.data || error.message || error);
    return res.status(500).json({
      error: "Deployment failed.",
      details: error.response?.data || error.message || error,
    });
  }
});

// 4️⃣ Start the server
app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`Send a POST request to /deploy with JSON like: { "url": "https://example.com" }\n`);
});
