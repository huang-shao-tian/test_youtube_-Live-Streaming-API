import { google } from "googleapis";
import { oauth2Client } from "./config/oauthConfig";
import { YouTubeChatRetrieval } from "./services/chatRetrieval";

async function quickTest() {
  const youtube = google.youtube({
    version: "v3",
    auth: oauth2Client,
  });

  const broadcast = await youtube.liveBroadcasts.list({
    part: ["snippet"],
    broadcastStatus: "active",
  });

  const liveChatId = broadcast.data.items?.[0]?.snippet?.liveChatId;
  console.log("Live Chat ID:", liveChatId);

  if (!liveChatId) {
    throw new Error("Live stream not found");
  }

  // Start retrieving chat messages using this ID
  const chatRetrieval = new YouTubeChatRetrieval(oauth2Client);

  let messageCount = 0;
  let errorCount = 0;
  const messageHistory: Array<{
    timestamp: string;
    author: string;
    message: string;
  }> = [];

  chatRetrieval.addMessageHandler(async (messages) => {
    if (messages.length > 0) {
      console.log("\n=== New Messages ===");
    }

    messageCount += messages.length;
    messages.forEach((msg) => {
      try {
        const timestamp = new Date().toISOString();
        const author = msg.authorDetails.displayName;
        const message = msg.snippet.displayMessage;

        messageHistory.push({ timestamp, author, message });
        console.log(`[${timestamp}] ${author}: ${message}`);
      } catch (error) {
        errorCount++;
        console.error("Message processing error:", error);
      }
    });

    // Display current statistics after each retrieval
    console.log("\nCurrent Statistics:");
    console.log(`Total Messages: ${messageCount}`);
    console.log(`Total Errors: ${errorCount}`);
    console.log("\n=== Message History ===");
    messageHistory.forEach(({ timestamp, author, message }, index) => {
      console.log(`${index + 1}. [${timestamp}] ${author}: ${message}`);
    });
    console.log("==================\n");
  });

  setTimeout(() => {
    console.log("\n=== Test Completed ===");
    process.exit(0);
  }, 3 * 60 * 1000);

  await chatRetrieval.start({
    liveChatId,
    pollingIntervalMs: 5000,
    maxResults: 10,
  });
}

quickTest().catch(console.error);
