// src/services/chatRetrieval.ts

import { google } from "googleapis";
import {
  ChatMessage,
  ChatRetrievalConfig,
  ChatRetrievalService,
  ChatRetrievalStatus,
  MessageHandler,
  YouTubeAPIErrorCode,
  YouTubeAPIErrorInfo,
} from "./types";

export class YouTubeChatRetrieval implements ChatRetrievalService {
  private youtube = google.youtube("v3");
  private isRunning: boolean = false;
  private nextPageToken: string | null = null;
  private messageHandlers: MessageHandler[] = [];
  private pollingTimeout: NodeJS.Timeout | null = null;
  private status: ChatRetrievalStatus = {
    isRunning: false,
    totalMessages: 0,
  };

  constructor(private readonly auth: any) {}

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

  private transformMessages(items: any[]): ChatMessage[] {
    return items.map((item) => ({
      id: item.id,
      kind: "youtube#liveChatMessage",
      snippet: {
        type: item.snippet.type,
        liveChatId: item.snippet.liveChatId,
        publishedAt: item.snippet.publishedAt,
        hasDisplayContent: item.snippet.hasDisplayContent,
        displayMessage: item.snippet.displayMessage,
      },
      authorDetails: {
        channelId: item.authorDetails.channelId,
        channelUrl: item.authorDetails.channelUrl,
        displayName: item.authorDetails.displayName,
        profileImageUrl: item.authorDetails.profileImageUrl,
        isVerified: item.authorDetails.isVerified,
        isChatOwner: item.authorDetails.isChatOwner,
        isChatSponsor: item.authorDetails.isChatSponsor,
        isChatModerator: item.authorDetails.isChatModerator,
      },
      superChatDetails: item.snippet.superChatDetails,
    }));
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
