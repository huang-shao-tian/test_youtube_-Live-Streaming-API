import { google, youtube_v3 } from "googleapis";
import { OAuth2Client } from "googleapis-common";
import {
  ChatMessage,
  ChatMessageType,
  ChatRetrievalConfig,
  ChatRetrievalStatus,
  MessageHandler,
  YouTubeAPIErrorCode,
  YouTubeAPIErrorInfo,
} from "./types.js";
import { z } from "zod";

export class YouTubeChatRetrieval {
  private youtube = google.youtube("v3");
  private isRunning: boolean = false;
  private nextPageToken: string | null = null;
  private messageHandlers: MessageHandler[] = [];
  private pollingTimeout: NodeJS.Timeout | null = null;
  private status: ChatRetrievalStatus = {
    isRunning: false,
    totalMessages: 0,
  };

  constructor(private readonly auth: OAuth2Client) {}

  public async start(config: ChatRetrievalConfig): Promise<void> {
    if (this.isRunning) {
      throw new Error("Chat retrieval is already running");
    }

    this.isRunning = true;
    this.status.isRunning = true;
    await this.pollMessages(config);
  }

  public stop(): void {
    this.isRunning = false;
    this.status.isRunning = false;
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
  }

  public addMessageHandler(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  public removeMessageHandler(handler: MessageHandler): void {
    this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
  }

  public getStatus(): ChatRetrievalStatus {
    return { ...this.status };
  }

  private async pollMessages(config: ChatRetrievalConfig): Promise<void> {
    if (!this.isRunning) return;

    try {
      const response = await this.youtube.liveChatMessages.list({
        auth: this.auth,
        part: ["snippet", "authorDetails"],
        liveChatId: config.liveChatId,
        pageToken: this.nextPageToken || undefined,
        maxResults: config.maxResults || 200,
      });

      const data = response.data;
      const messages = this.transformMessages(data.items || []);
      this.status.totalMessages += messages.length;
      this.status.lastRetrievalTime = new Date();

      if (messages.length > 0) {
        await this.notifyHandlers(messages);
      }

      this.nextPageToken = data.nextPageToken || null;
      const interval = data.pollingIntervalMillis || config.pollingIntervalMs;

      this.pollingTimeout = setTimeout(
        () => this.pollMessages(config),
        interval
      );
    } catch (error) {
      const apiError = this.handleError(error);
      this.status.currentError = apiError;

      if (
        apiError.retryable &&
        (!config.maxRetries || this.status.totalMessages < config.maxRetries)
      ) {
        this.pollingTimeout = setTimeout(
          () => this.pollMessages(config),
          config.retryDelayMs || 5000
        );
      } else {
        this.stop();
        throw error;
      }
    }
  }

  private transformMessages(
    items: youtube_v3.Schema$LiveChatMessage[]
  ): ChatMessage[] {
    const schema = z.object({
      id: z.string(),
      kind: z.literal("youtube#liveChatMessage"),
      snippet: z.object({
        type: z.enum([
          "textMessageEvent",
          "superChatEvent",
          "superStickerEvent",
          "messageDeletedEvent",
          "chatEndedEvent",
        ]),
        liveChatId: z.string(),
        publishedAt: z.string(),
        hasDisplayContent: z.boolean(),
        displayMessage: z.string(),
        superChatDetails: z.object({
          amountMicros: z.number(),
          currency: z.string(),
          amountDisplayString: z.string(),
          userComment: z.string(),
          tier: z.number(),
        }),
      }),
      authorDetails: z.object({
        channelId: z.string(),
        channelUrl: z.string(),
        displayName: z.string(),
        profileImageUrl: z.string(),
        isVerified: z.boolean(),
        isChatOwner: z.boolean(),
        isChatSponsor: z.boolean(),
        isChatModerator: z.boolean(),
      }),
    });

    return items.map((item) => {
      const parsed = schema.parse(item);
      return {
        id: parsed.id,
        kind: "youtube#liveChatMessage",
        snippet: {
          type: parsed.snippet.type as ChatMessageType,
          liveChatId: parsed.snippet.liveChatId,
          publishedAt: parsed.snippet.publishedAt,
          hasDisplayContent: parsed.snippet.hasDisplayContent,
          displayMessage: parsed.snippet.displayMessage,
        },
        authorDetails: {
          channelId: parsed.authorDetails.channelId,
          channelUrl: parsed.authorDetails.channelUrl,
          displayName: parsed.authorDetails.displayName,
          profileImageUrl: parsed.authorDetails.profileImageUrl,
          isVerified: parsed.authorDetails.isVerified,
          isChatOwner: parsed.authorDetails.isChatOwner,
          isChatSponsor: parsed.authorDetails.isChatSponsor,
          isChatModerator: parsed.authorDetails.isChatModerator,
        },
        superChatDetails: parsed.snippet.superChatDetails,
      };
    });
  }

  private async notifyHandlers(messages: ChatMessage[]): Promise<void> {
    const context = {
      retrievedAt: new Date(),
      totalMessages: this.status.totalMessages,
    };

    for (const handler of this.messageHandlers) {
      try {
        await handler(messages, context);
      } catch (error) {
        console.error("Error in message handler:", error);
      }
    }
  }

  private handleError(error: any): YouTubeAPIErrorInfo {
    const message = error.response?.data?.error?.message || error.message;
    const code = this.determineErrorCode(error);
    const retryable = this.isRetryableError(code);

    return {
      code,
      message,
      retryable,
    };
  }

  private determineErrorCode(error: any): YouTubeAPIErrorCode {
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;

    switch (status) {
      case 403:
        return code === "quotaExceeded"
          ? YouTubeAPIErrorCode.QUOTA_EXCEEDED
          : YouTubeAPIErrorCode.RATE_LIMIT_EXCEEDED;
      case 401:
        return YouTubeAPIErrorCode.AUTHENTICATION_ERROR;
      case 400:
        return YouTubeAPIErrorCode.INVALID_PARAMETER;
      case 404:
        return YouTubeAPIErrorCode.NOT_FOUND;
      default:
        return YouTubeAPIErrorCode.UNKNOWN;
    }
  }

  private isRetryableError(code: YouTubeAPIErrorCode): boolean {
    return [
      YouTubeAPIErrorCode.RATE_LIMIT_EXCEEDED,
      YouTubeAPIErrorCode.QUOTA_EXCEEDED,
    ].includes(code);
  }
}
