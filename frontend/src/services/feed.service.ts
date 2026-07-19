import apiService from './api';
import { Post, Comment, PaginatedResponse } from '../types';

export const feedService = {
  // Get feed posts. Verified via direct probe against production API: GET
  // /api/feed -> 404, GET /api/feed/posts -> 200 (returns { posts: [...] }).
  async getFeed(params?: { page?: number; per_page?: number }): Promise<PaginatedResponse<Post>> {
    return await apiService.get<PaginatedResponse<Post>>('/feed/posts', { params });
  },

  // Create post
  async createPost(content: string, images?: string[]): Promise<Post> {
    return await apiService.post<Post>('/feed/posts', { content, images });
  },

  // Like/unlike post
  async toggleLike(postId: string): Promise<void> {
    return await apiService.post(`/feed/${postId}/like`);
  },

  // Get post comments
  async getComments(
    postId: string,
    params?: { page?: number; per_page?: number }
  ): Promise<PaginatedResponse<Comment>> {
    return await apiService.get<PaginatedResponse<Comment>>(`/feed/${postId}/comments`, {
      params,
    });
  },

  // Add comment
  async addComment(postId: string, content: string): Promise<Comment> {
    return await apiService.post<Comment>(`/feed/${postId}/comments`, { content });
  },

  // Delete post
  async deletePost(postId: string): Promise<void> {
    return await apiService.delete(`/feed/${postId}`);
  },
};

// NOTE: review-related API calls live in src/services/review.service.ts
// (real reviewService, actually imported/used by the app). A dead duplicate
// `reviewService` export used to live here - removed to avoid two
// conflicting sources of truth for the same feature.