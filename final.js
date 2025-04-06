const express = require("express");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { execSync } = require("child_process");

const app = express();
const PORT = 3000;

app.use(express.json());

app.post("/deploy", async (req, res) => {
  try {
    // 🟡 Required headers
    const netlifyAuthToken = req.headers["netlify-auth-token"];
    const netlifySiteId = req.headers["netlify-site-id"]; // optional

    if (!netlifyAuthToken) {
      return res.status(400).json({ error: "Missing 'netlify-auth-token' header." });
    }

    // 🔵 Determine endpoint (existing site vs. new site)
    const netlifyEndpoint = netlifySiteId
      ? `https://api.netlify.com/api/v1/sites/${netlifySiteId}/deploys`
      : "https://api.netlify.com/api/v1/sites";

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Missing 'url' in request body." });
    }

    console.log(`🌍 Fetching HTML from: ${url}`);

    // Setup paths
    const baseFolder = __dirname;
    const buildFolder = path.join(baseFolder, "build");
    const indexFile = path.join(buildFolder, "index.html");
    const zipFile = path.join(baseFolder, "site.zip");

    const response = await axios.get(url);
    if (typeof response.data !== "string") {
      return res.status(400).json({ error: "URL did not return raw HTML content." });
    }

    fs.ensureDirSync(buildFolder);
    fs.writeFileSync(indexFile, response.data, "utf8");
    console.log(`✅ Saved HTML to: ${indexFile}`);

    if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);

    console.log("📦 Zipping folder...");
    execSync(`zip -r "${zipFile}" "${buildFolder}"`, { stdio: "inherit" });

    const zipBuffer = fs.readFileSync(zipFile);

    console.log("🚀 Deploying to Netlify...");
    console.log("Using endpoint:", netlifyEndpoint);

    const deployResp = await axios.post(netlifyEndpoint, zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        Authorization: `Bearer ${netlifyAuthToken}`,
      },
    });

    const data = deployResp.data;
    console.log("🎉 Deploy complete:", data.deploy_url || data.url);

    res.json({
      message: "Deployment success!",
      link: data.deploy_url || data.url || null,
    });
  } catch (error) {
    console.error("❌ Deploy error:", error.response?.data || error.message || error);
    res.status(500).json({
      error: "Deployment failed.",
      details: error.response?.data || error.message || error,
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
