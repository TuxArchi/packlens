import type {
  ChannelOutliers,
  KeywordSearchResult,
  QuotaState,
  VideoData,
} from './types';

export type ExtensionRequest =
  | { type: 'GET_VIDEO_DATA'; tabId?: number }
  | { type: 'OPEN_SIDEBAR' }
  | { type: 'VIDEO_CHANGED'; videoId?: string | null }
  | { type: 'GET_STUDIO_DATA' }
  | { type: 'READ_PLAYER_RESPONSE' }
  | { type: 'GET_CHANNEL_OUTLIERS'; tabId?: number }
  | { type: 'SEARCH_KEYWORD'; keyword: string; mode?: 'api' | 'session' }
  | { type: 'EXPAND_STUDIO_TAGS' }
  | { type: 'ADD_STUDIO_TAGS'; tags: string[]; videoId?: string | null }
  | { type: 'SET_STUDIO_TITLE'; title: string; videoId?: string | null }
  | { type: 'GET_QUOTA' };

export interface VideoDataResponse {
  ok: boolean;
  data?: VideoData | null;
  error?: string;
}

export interface SimpleResponse {
  ok: boolean;
  error?: string;
}

export interface ChannelOutliersResponse {
  ok: boolean;
  data?: ChannelOutliers | null;
  error?: string;
}

export type KeywordErrorCode =
  | 'no-key'
  | 'quota'
  | 'invalid-key'
  | 'bad-request'
  | 'session'
  | 'api';

export interface KeywordSearchResponse {
  ok: boolean;
  data?: KeywordSearchResult;
  error?: string;
  code?: KeywordErrorCode;
}

export interface QuotaResponse {
  ok: boolean;
  data?: QuotaState;
}

export interface OpenPanelResponse {
  ok: boolean;
  mode?: 'sidebar' | 'window';
  error?: string;
}

export interface StudioWriteResponse {
  ok: boolean;
  added?: number;
  skipped?: number;
  error?: string;
  needsPaste?: boolean;
}
