import "dotenv/config";
import { google } from "googleapis";
import clientSecret from "./client_secret.json";
import fs from "fs/promises";
import path from "path";
import { OAuthTokens } from "../services/types.js";

// Initialize oauth2Client
export const oauth2Client = new google.auth.OAuth2(
  clientSecret.web.client_id,
  clientSecret.web.client_secret,
  clientSecret.web.redirect_uris[0]
);

export const scopes = ["https://www.googleapis.com/auth/youtube.force-ssl"];

// Function to save tokens to .env file
export const saveOAuthTokens = async (
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
export const loadAndSetTokens = async () => {
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

await loadAndSetTokens();
