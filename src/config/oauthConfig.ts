import 'dotenv/config';
import {google} from 'googleapis';
import crypto from 'crypto';
import express from 'express';
import session from 'express-session';
import clientSecret from './client_secret.json';

// ファイルの先頭に型定義を追加
declare module 'express-session' {
    interface SessionData {
        state: string;
    }
}

const app = express();

app.use(session({
    secret: process.env.SESSION_SECRET as string,
    resave: false,
    saveUninitialized: true
}));

// ルートハンドラーをここに追加
app.get('/auth', (req: express.Request, res: express.Response) => {
    const authUrl = generateAuthUrl(req);
    res.redirect(authUrl);
});


app.get('/oauth2callback',
    (req: express.Request, res: express.Response, next: express.NextFunction): void => {
        try {
            const state = req.query.state as string;
            const code = req.query.code as string;

            if (state !== req.session.state) {
                res.status(401).send('Invalid state parameter');
                return;
            }

            oauth2Client.getToken(code)
                .then(({tokens}) => {
                    oauth2Client.setCredentials(tokens);
                    res.send('認証成功！');
                })
                .catch(next);

        } catch (error) {
            next(error);
        }
    }
);

const oauth2Client = new google.auth.OAuth2(
    clientSecret.web.client_id,
    clientSecret.web.client_secret,
    clientSecret.web.redirect_uris[0]
);

const scopes = [
    // 'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.force-ssl'
];

// stateの生成とURLの作成をファンクションとして定義
function generateAuthUrl(req: express.Request) {
    const state = crypto.randomBytes(32).toString('hex');
    req.session.state = state;

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        include_granted_scopes: true,
        state: state
    });
}


// サーバーを起動
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});