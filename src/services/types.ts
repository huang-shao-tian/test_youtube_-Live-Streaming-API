// src/services/types.ts

/**
 * YouTube APIのエラーコード
 */
export enum YouTubeAPIErrorCode {
  /** クォータ超過 */
  QUOTA_EXCEEDED = "quotaExceeded",
  /** レート制限超過 */
  RATE_LIMIT_EXCEEDED = "rateLimitExceeded",
  /** 認証エラー */
  AUTHENTICATION_ERROR = "authenticationError",
  /** 無効なパラメータ */
  INVALID_PARAMETER = "invalidParameter",
  /** リソースが見つからない */
  NOT_FOUND = "notFound",
  /** その他のエラー */
  UNKNOWN = "unknown",
}

/**
 * YouTube APIのエラー情報
 */
export interface YouTubeAPIErrorInfo {
  /** エラーコード */
  code: YouTubeAPIErrorCode;
  /** エラーメッセージ */
  message: string;
  /** リトライ可能かどうか */
  retryable: boolean;
}

/**
 * チャット取得の設定オプション
 */
export interface ChatRetrievalConfig {
  /** 取得対象のライブチャットID */
  liveChatId: string;
  /** ポーリング間隔（ミリ秒） */
  pollingIntervalMs: number;
  /** 1回のリクエストで取得する最大メッセージ数（デフォルト: 200） */
  maxResults?: number;
  /** エラー時の最大リトライ回数（デフォルト: 3） */
  maxRetries?: number;
  /** リトライ時の待機時間（ミリ秒）（デフォルト: 5000） */
  retryDelayMs?: number;
}

/**
 * メッセージハンドラーのコンテキスト情報
 */
export interface MessageHandlerContext {
  /** メッセージの取得時刻 */
  retrievedAt: Date;
  /** 累積メッセージ数 */
  totalMessages: number;
  /** エラーが発生した場合の情報 */
  error?: YouTubeAPIErrorInfo;
}

/**
 * メッセージハンドラー関数の型定義
 */
export type MessageHandler = (
  messages: ChatMessage[],
  context: MessageHandlerContext
) => Promise<void>;

/**
 * チャット取得サービスのインターフェース
 */
export interface ChatRetrievalService {
  /**
   * チャット取得を開始
   * @param config 取得設定
   * @throws {YouTubeAPIError} API呼び出しに失敗した場合
   */
  start(config: ChatRetrievalConfig): Promise<void>;

  /**
   * チャット取得を停止
   */
  stop(): void;

  /**
   * メッセージハンドラーを追加
   * @param handler メッセージを処理するハンドラー関数
   */
  addMessageHandler(handler: MessageHandler): void;

  /**
   * メッセージハンドラーを削除
   * @param handler 削除するハンドラー関数
   */
  removeMessageHandler(handler: MessageHandler): void;

  /**
   * 現在の実行状態を取得
   */
  getStatus(): ChatRetrievalStatus;
}

/**
 * チャット取得の実行状態
 */
export interface ChatRetrievalStatus {
  /** 実行中かどうか */
  isRunning: boolean;
  /** 最後のメッセージ取得時刻 */
  lastRetrievalTime?: Date;
  /** 累積メッセージ数 */
  totalMessages: number;
  /** 現在のエラー情報 */
  currentError?: YouTubeAPIErrorInfo;
}

/**
 * チャットメッセージの種類を定義
 */
export enum ChatMessageType {
  /** 通常のテキストメッセージ */
  TEXT_MESSAGE = "textMessageEvent",
  /** スーパーチャット */
  SUPER_CHAT = "superChatEvent",
  /** スーパーステッカー */
  SUPER_STICKER = "superStickerEvent",
  /** メッセージ削除 */
  MESSAGE_DELETED = "messageDeletedEvent",
  /** チャット終了 */
  CHAT_ENDED = "chatEndedEvent",
}

/**
 * チャットメッセージの著者情報
 */
export interface ChatAuthorDetails {
  /** チャンネルID */
  channelId: string;
  /** チャンネルURL */
  channelUrl: string;
  /** 表示名 */
  displayName: string;
  /** プロフィール画像URL */
  profileImageUrl: string;
  /** 認証済みかどうか */
  isVerified: boolean;
  /** 配信者かどうか */
  isChatOwner: boolean;
  /** メンバーシップ加入者かどうか */
  isChatSponsor: boolean;
  /** モデレーターかどうか */
  isChatModerator: boolean;
}

/**
 * スーパーチャットの詳細情報
 */
export interface SuperChatDetails {
  /** 金額（マイクロ単位） */
  amountMicros: number;
  /** 通貨コード（ISO 4217） */
  currency: string;
  /** 表示用金額文字列 */
  amountDisplayString: string;
  /** ユーザーコメント */
  userComment: string;
  /** スーパーチャットの階層（1-5） */
  tier: number;
}

/**
 * チャットメッセージの基本情報
 */
export interface ChatMessageSnippet {
  /** メッセージの種類 */
  type: ChatMessageType;
  /** ライブチャットID */
  liveChatId: string;
  /** 投稿日時（ISO 8601形式） */
  publishedAt: string;
  /** メッセージが表示可能かどうか */
  hasDisplayContent: boolean;
  /** 表示メッセージ */
  displayMessage: string;
}

/**
 * チャットメッセージの完全な構造
 */
export interface ChatMessage {
  /** メッセージの一意のID */
  id: string;
  /** メッセージの種類を示す文字列 */
  kind: "youtube#liveChatMessage";
  /** メッセージの基本情報 */
  snippet: ChatMessageSnippet;
  /** 著者の詳細情報 */
  authorDetails: ChatAuthorDetails;
  /** スーパーチャットの情報（存在する場合） */
  superChatDetails?: SuperChatDetails;
}
