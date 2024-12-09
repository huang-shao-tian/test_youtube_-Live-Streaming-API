import "dotenv/config";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const generateSecret = (length: number = 32): string => {
  return crypto.randomBytes(length).toString("hex");
};

const saveSecretToEnv = async (
  secretKey: string,
  secretValue: string,
  envPath: string = ".env"
): Promise<void> => {
  const getRootPath = () => {
    const rootPath = process.env.ROOT_DIR;
    if (!rootPath) {
      throw new Error("ROOT_PATH environment variable is not set.");
    }
    return rootPath;
  };

  const ROOT_DIR = getRootPath();
  const absolutePath = path.resolve(ROOT_DIR, envPath);

  try {
    let envContent = "";
    try {
      envContent = await fs.readFile(absolutePath, "utf-8");
    } catch (error) {
      console.error(`Error reading .env file at ${absolutePath}:`, error);
      throw error;
    }

    const envLines = envContent
      .split("\n")
      .filter((line) => line.trim() !== "");
    const secretKeyExists = envLines.some((line) =>
      line.startsWith(`${secretKey}=`)
    );

    if (secretKeyExists) {
      const updatedLines = envLines.map((line) => {
        if (line.startsWith(`${secretKey}=`)) {
          return `${secretKey}=${secretValue}`;
        }
        return line;
      });
      envContent = updatedLines.join("\n");
    } else {
      envContent = `${envContent}\n${secretKey}=${secretValue}`.trim();
    }

    await fs.writeFile(absolutePath, envContent + "\n", "utf-8");
    console.log(`Secret "${secretKey}" has been saved to ${absolutePath}`);
  } catch (error) {
    console.error("Error saving secret to .env file:", error);
    throw error;
  }
};

const main = async () => {
  try {
    const secret = generateSecret();
    await saveSecretToEnv("SESSION_SECRET", secret);
  } catch (error) {
    console.error("Error in main execution:", error);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

export { generateSecret, saveSecretToEnv };
