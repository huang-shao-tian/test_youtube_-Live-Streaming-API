import express from "express";
import session from "express-session";
import crypto from "crypto";
import { z } from "zod";
import { oauth2Client, scopes, saveOAuthTokens } from "./oauth2Client.js";

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

const startServer = async () => {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

await startServer();
