import "dotenv/config";
import { google } from "googleapis";
import crypto from "crypto";
import express from "express";
import session from "express-session";
import clientSecret from "./client_secret.json";
import { OAuthTokens } from "../services/types.js";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

declare module "express-session" {
  interface SessionData {
    state: string;
  }
}

const app = express();

app.use(
  session({
    secret: z.string().min(32).parse(process.env.SESSION_SECRET),
    resave: false,
    saveUninitialized: true,
  })
);

app.get("/auth", (req, res) => {
  const authUrl = generateAuthUrl(req);
  res.redirect(authUrl);
});

app.get("/oauth2callback", async (req, res, next: express.NextFunction) => {
  try {
    const state = z.string().min(32).parse(req.query.state);
    const code = z.string().parse(req.query.code);

    if (state !== req.session.state) {
      res.status(401).send("Invalid state parameter");
      return;
    }

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    await saveOAuthTokens({
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token ?? null,
    });
    res.send("Authentication successful!");
  } catch (error) {
    next(error);
  }
});

// Initialize oauth2Client
export const oauth2Client = new google.auth.OAuth2(
  clientSecret.web.client_id,
  clientSecret.web.client_secret,
  clientSecret.web.redirect_uris[0]
);

const scopes = ["https://www.googleapis.com/auth/youtube.force-ssl"];

function generateAuthUrl(req: express.Request) {
  const state = crypto.randomBytes(32).toString("hex");
  req.session.state = state;

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    include_granted_scopes: true,
    state: state,
  });
}

// Function to save tokens to .env file
const saveOAuthTokens = async (
  tokens: OAuthTokens,
  savePath: string = "src/credentials/OAuth2.0-tokens.json"
): Promise<void> => {
  const getRootPath = () => {
    const rootPath = process.env.ROOT_DIR;
    if (!rootPath) {
      throw new Error("Environment variable ROOT_DIR is not set.");
    }
    return rootPath;
  };

  const ROOT_DIR = getRootPath();
  const absolutePath = path.resolve(ROOT_DIR, savePath);

  try {
    let tokensContent: { ACCESS_TOKEN?: string; REFRESH_TOKEN?: string } = {};
    try {
      tokensContent = JSON.parse(await fs.readFile(absolutePath, "utf-8"));
    } catch (error) {
      console.error(`Error loading OAuth tokens from ${absolutePath}:`, error);
      throw error;
    }

    if (tokens.access_token) tokensContent.ACCESS_TOKEN = tokens.access_token;
    if (tokens.refresh_token)
      tokensContent.REFRESH_TOKEN = tokens.refresh_token;

    await fs.writeFile(
      absolutePath,
      JSON.stringify(tokensContent, null, 2),
      "utf-8"
    );
    console.log(`OAuth tokens have been saved to ${absolutePath}`);
  } catch (error) {
    console.error(`Error saving OAuth tokens to ${absolutePath}:`, error);
    throw error;
  }
};

// Execute on startup
const loadAndSetTokens = async () => {
  const getRootPath = () => {
    const rootPath = process.env.ROOT_DIR;
    if (!rootPath) {
      throw new Error("Environment variable ROOT_DIR is not set.");
    }
    return rootPath;
  };

  const ROOT_DIR = getRootPath();
  const absolutePath = path.resolve(
    ROOT_DIR,
    "src/credentials/OAuth2.0-tokens.json"
  );

  let tokensContent: { ACCESS_TOKEN?: string; REFRESH_TOKEN?: string } = {};

  try {
    const fileContent = await fs.readFile(absolutePath, "utf-8");
    if (!fileContent) {
      console.warn(`The file ${absolutePath} is empty.`);
      return;
    }
    tokensContent = JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error loading OAuth tokens from ${absolutePath}:`, error);
    throw error;
  }
  const accessToken = tokensContent.ACCESS_TOKEN;
  const refreshToken = tokensContent.REFRESH_TOKEN;

  if (accessToken || refreshToken) {
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    console.log("Loaded existing tokens");
  }
};

const startServer = async () => {
  await loadAndSetTokens();
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

await startServer();
