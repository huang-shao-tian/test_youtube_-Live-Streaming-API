import "dotenv/config";
import { google } from "googleapis";
import crypto from "crypto";
import express from "express";
import session from "express-session";
import clientSecret from "./client_secret.json";
import fs from "fs/promises";
import path from "path";

interface OAuthTokens {
  access_token: string | null | undefined;
  refresh_token: string | null | undefined;
}

// ファイルの先頭に型定義を追加
declare module "express-session" {
  interface SessionData {
    state: string;
  }
}

const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET as string,
    resave: false,
    saveUninitialized: true,
  })
);

// ルートハンドラーをここに追加
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
          res.send("認証成功！");
        })
        .catch(next);
    } catch (error) {
      next(error);
    }
  }
);

// 先にoauth2Clientを初期化
export const oauth2Client = new google.auth.OAuth2(
  clientSecret.web.client_id,
  clientSecret.web.client_secret,
  clientSecret.web.redirect_uris[0]
);

const scopes = [
  // 'https://www.googleapis.com/auth/youtube.readonly',
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

// stateの生成とURLの作成をファンクションとして定義
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

// トークンを.envファイルに保存する関数
const saveOAuthTokens = async (
  tokens: OAuthTokens,
  envPath: string = ".env"
): Promise<void> => {
  const getRootPath = () => {
    const rootPath = process.env.ROOT_DIR;
    if (!rootPath) {
      throw new Error("環境変数 ROOT_DIR が設定されていません。");
    }
    return rootPath;
  };

  const ROOT_DIR = getRootPath();
  const absolutePath = path.resolve(ROOT_DIR, envPath);

  try {
    // .envファイルが存在するか確認
    let envContent = "";
    try {
      envContent = await fs.readFile(absolutePath, "utf-8");
    } catch (error) {
      // ファイルが存在しない場合は空文字列のまま
    }

    // 既存の値を更新または新しい値を追加
    const envLines = envContent
      .split("\n")
      .filter((line) => line.trim() !== "");
    const updatedLines = envLines.filter((line) => {
      if (!line.startsWith("ACCESS_TOKEN=")) {
        if (line.startsWith("REFRESH_TOKEN=")) {
          // refresh_tokenが存在する場合のみ、既存のREFRESH_TOKEN行を削除
          return !tokens.refresh_token;
        }
        return true;
      }
      return false;
    });

    // 新しいトークンを追加
    if (tokens.access_token)
      updatedLines.push(`ACCESS_TOKEN=${tokens.access_token}`);
    if (tokens.refresh_token)
      updatedLines.push(`REFRESH_TOKEN=${tokens.refresh_token}`);

    // ファイルに書き込み
    await fs.writeFile(absolutePath, updatedLines.join("\n") + "\n", "utf-8");
    console.log(`OAuth tokens have been saved to ${absolutePath}`);
  } catch (error) {
    console.error("Error saving OAuth tokens to .env file:", error);
    throw error;
  }
};

// 起動時に実行
const loadAndSetTokens = () => {
  const accessToken = process.env.ACCESS_TOKEN;
  const refreshToken = process.env.REFRESH_TOKEN;

  if (accessToken || refreshToken) {
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    console.log("既存のトークンを読み込みました");
  }
};

// 最後に関数を実行
loadAndSetTokens();

// サーバーを起動
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
