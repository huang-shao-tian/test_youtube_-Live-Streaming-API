// src/services/types.ts

/**
 * Error codes for YouTube API
 */
export enum YouTubeAPIErrorCode {
  QUOTA_EXCEEDED = "quotaExceeded",
  RATE_LIMIT_EXCEEDED = "rateLimitExceeded",
  AUTHENTICATION_ERROR = "authenticationError",
  INVALID_PARAMETER = "invalidParameter",
  NOT_FOUND = "notFound",
  UNKNOWN = "unknown",
}

/**
 * YouTube API error information
 */
export interface YouTubeAPIErrorInfo {
  code: YouTubeAPIErrorCode;
  message: string;
  retryable: boolean;
}

/**
 * Chat retrieval configuration options
 */
export interface ChatRetrievalConfig {
  liveChatId: string;
  pollingIntervalMs: number;
  /** Maximum number of messages per request (default: 200) */
  maxResults?: number;
  /** Maximum number of retries on error (default: 3) */
  maxRetries?: number;
  /** Delay between retries in milliseconds (default: 5000) */
  retryDelayMs?: number;
}

/**
 * Message handler context information
 */
export interface MessageHandlerContext {
  retrievedAt: Date;
  totalMessages: number;
  error?: YouTubeAPIErrorInfo;
}

/**
 * Message handler function type definition
 */
export type MessageHandler = (
  messages: ChatMessage[],
  context: MessageHandlerContext
) => Promise<void>;

/**
 * Chat retrieval service interface
 */
export interface ChatRetrievalService {
  /**
   * Start chat retrieval
   * @param config Retrieval configuration
   * @throws {YouTubeAPIError} When API call fails
   */
  start(config: ChatRetrievalConfig): Promise<void>;

  /**
   * Stop chat retrieval
   */
  stop(): void;

  /**
   * Add message handler
   * @param handler Function to process messages
   */
  addMessageHandler(handler: MessageHandler): void;

  /**
   * Remove message handler
   * @param handler Handler function to remove
   */
  removeMessageHandler(handler: MessageHandler): void;

  /**
   * Get current execution status
   */
  getStatus(): ChatRetrievalStatus;
}

/**
 * Chat retrieval execution status
 */
export interface ChatRetrievalStatus {
  isRunning: boolean;
  lastRetrievalTime?: Date;
  totalMessages: number;
  currentError?: YouTubeAPIErrorInfo;
}

/**
 * Chat message types
 */
export enum ChatMessageType {
  /** Normal text message */
  TEXT_MESSAGE = "textMessageEvent",
  SUPER_CHAT = "superChatEvent",
  SUPER_STICKER = "superStickerEvent",
  MESSAGE_DELETED = "messageDeletedEvent",
  CHAT_ENDED = "chatEndedEvent",
}

/**
 * Chat author details
 */
export interface ChatAuthorDetails {
  channelId: string;
  channelUrl: string;
  displayName: string;
  profileImageUrl: string;
  isVerified: boolean;
  /** Whether the user is the stream owner */
  isChatOwner: boolean;
  /** Whether the user is a channel member */
  isChatSponsor: boolean;
  /** Whether the user is a moderator */
  isChatModerator: boolean;
}

/**
 * Super Chat details
 */
export interface SuperChatDetails {
  amountMicros: number;
  /** Currency code (ISO 4217) */
  currency: string;
  /** Formatted amount string */
  amountDisplayString: string;
  /** User comment */
  userComment: string;
  /** Super Chat tier (1-5) */
  tier: number;
}

/**
 * Basic chat message information
 */
export interface ChatMessageSnippet {
  type: ChatMessageType;
  liveChatId: string;
  /** Published time (ISO 8601 format) */
  publishedAt: string;
  /** Whether the message has displayable content */
  hasDisplayContent: boolean;
  displayMessage: string;
}

/**
 * Complete chat message structure
 */
export interface ChatMessage {
  /** Unique message ID */
  id: string;
  /** Message type string */
  kind: "youtube#liveChatMessage";
  /** Basic message information */
  snippet: ChatMessageSnippet;
  authorDetails: ChatAuthorDetails;
  superChatDetails?: SuperChatDetails;
}
