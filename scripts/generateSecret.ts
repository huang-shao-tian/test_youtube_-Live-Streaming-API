import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// シークレットを生成する関数
const generateSecret = (length: number = 32): string => {
    return crypto.randomBytes(length).toString('hex');
  };

// .envファイルにシークレットを保存する関数
const saveSecretToEnv = async (
    secretKey: string,
    secretValue: string,
    envPath: string = '.env'
  ): Promise<void> => {
    const getRootPath = () => {
        const rootPath = process.env.ROOT_DIR;
        if (!rootPath) {
          throw new Error('環境変数 ROOT_PATH が設定されていません。');
        }
        return rootPath;
      };

    const ROOT_DIR = getRootPath();
    const absolutePath = path.resolve(ROOT_DIR, envPath);

    try {
      // .envファイルが存在するか確認
      let envContent = '';
      try {
        envContent = await fs.readFile(absolutePath, 'utf-8');
      } catch (error) {
        // ファイルが存在しない場合は空文字列のまま
      }

      // 既存の値を更新または新しい値を追加
      const envLines = envContent.split('\n').filter(line => line.trim() !== '');
      const secretKeyExists = envLines.some(line => line.startsWith(`${secretKey}=`));

      if (secretKeyExists) {
        // 既存の値を更新
        const updatedLines = envLines.map(line => {
          if (line.startsWith(`${secretKey}=`)) {
            return `${secretKey}=${secretValue}`;
          }
          return line;
        });
        envContent = updatedLines.join('\n');
      } else {
        // 新しい値を追加
        envContent = `${envContent}\n${secretKey}=${secretValue}`.trim();
      }

      // ファイルに書き込み
      await fs.writeFile(absolutePath, envContent + '\n', 'utf-8');
      console.log(`Secret "${secretKey}" has been saved to ${absolutePath}`);
    } catch (error) {
      console.error('Error saving secret to .env file:', error);
      throw error;
    }
  };

  // メイン実行関数
  const main = async () => {
    try {
      // シークレットを生成
      const secret = generateSecret();

      // .envファイルに保存
      await saveSecretToEnv('SESSION_SECRET', secret);
    } catch (error) {
      console.error('Error in main execution:', error);
      process.exit(1);
    }
  };

  // スクリプトが直接実行された場合のみメイン関数を実行
  if (require.main === module) {
    main();
  }

  // モジュールとしてインポートできるようにエクスポート
  export { generateSecret, saveSecretToEnv };