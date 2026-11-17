import type { ChannelFetchStatus, RawSocialPost } from "../types";

export interface ChannelFetchResponse {
  posts: RawSocialPost[];
  status: ChannelFetchStatus;
}
