import "dotenv/config";
import { google } from "googleapis";
import crypto from "crypto";
import express from "express";
import session from "express-session";
import clientSecret from "./client_secret.json";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

interface OAuthTokens {
  access_token: string | null | undefined;
  refresh_token: string | null | undefined;
}

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

app.get("/auth", (req: express.Request, res: express.Response) => {
  const authUrl = generateAuthUrl(req);
  res.redirect(authUrl);
});

app.get(
  "/oauth2callback",
  (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void => {
    try {
      const state = req.query.state as string;
      const code = req.query.code as string;

      if (state !== req.session.state) {
        res.status(401).send("Invalid state parameter");
        return;
      }

      oauth2Client
        .getToken(code)
        .then(({ tokens }) => {
          oauth2Client.setCredentials(tokens);
          saveOAuthTokens({
            access_token: tokens.access_token ?? null,
            refresh_token: tokens.refresh_token ?? null,
          });
          res.send("Authentication successful!");
        })
        .catch(next);
    } catch (error) {
      next(error);
    }
  }
);

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
  envPath: string = ".env"
): Promise<void> => {
  const getRootPath = () => {
    const rootPath = process.env.ROOT_DIR;
    if (!rootPath) {
      throw new Error("Environment variable ROOT_DIR is not set.");
    }
    return rootPath;
  };

  const ROOT_DIR = getRootPath();
  const absolutePath = path.resolve(ROOT_DIR, envPath);

  try {
    let envContent = "";
    try {
      envContent = await fs.readFile(absolutePath, "utf-8");
    } catch (error) {}

    const envLines = envContent
      .split("\n")
      .filter((line) => line.trim() !== "");
    const updatedLines = envLines.filter((line) => {
      if (!line.startsWith("ACCESS_TOKEN=")) {
        if (line.startsWith("REFRESH_TOKEN=")) {
          return !tokens.refresh_token;
        }
        return true;
      }
      return false;
    });

    if (tokens.access_token)
      updatedLines.push(`ACCESS_TOKEN=${tokens.access_token}`);
    if (tokens.refresh_token)
      updatedLines.push(`REFRESH_TOKEN=${tokens.refresh_token}`);

    await fs.writeFile(absolutePath, updatedLines.join("\n") + "\n", "utf-8");
    console.log(`OAuth tokens have been saved to ${absolutePath}`);
  } catch (error) {
    console.error("Error saving OAuth tokens to .env file:", error);
    throw error;
  }
};

// Execute on startup
const loadAndSetTokens = () => {
  const accessToken = process.env.ACCESS_TOKEN;
  const refreshToken = process.env.REFRESH_TOKEN;

  if (accessToken || refreshToken) {
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    console.log("Loaded existing tokens");
  }
};

loadAndSetTokens();

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
