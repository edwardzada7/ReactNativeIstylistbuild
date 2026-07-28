import apiService from './api';
import { Post, Comment, PaginatedResponse } from '../types';

export const feedService = {
  // Get feed posts. Web backend returns { posts: [...], total, limit, offset }
  async getFeed(params?: { page?: number; per_page?: number }): Promise<PaginatedResponse<Post>> {
    const response = await apiService.get<any>('/feed/posts', { params });
    // Transform web backend response to mobile format
    return {
      data: response.posts || [],
      total: response.total || 0,
      page: params?.page || 1,
      per_page: params?.per_page || 20,
      total_pages: Math.ceil((response.total || 0) / (params?.per_page || 20)),
    };
  },

  // Create post
  async createPost(caption: string, image_url: string): Promise<Post> {
    const authId = await apiService.getAuthId();
    if (!authId) throw new Error('Not authenticated');
    return await apiService.post<Post>(`/feed/posts?auth_id=${authId}`, { caption, image_url });
  },

  // Like post
  async likePost(postId: string): Promise<void> {
    const authId = await apiService.getAuthId();
    if (!authId) throw new Error('Not authenticated');
    return await apiService.post(`/feed/posts/${postId}/like?auth_id=${authId}`);
  },

  // Unlike post
  async unlikePost(postId: string): Promise<void> {
    const authId = await apiService.getAuthId();
    if (!authId) throw new Error('Not authenticated');
    return await apiService.delete(`/feed/posts/${postId}/like?auth_id=${authId}`);
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
    const authId = await apiService.getAuthId();
    if (!authId) throw new Error('Not authenticated');
    return await apiService.delete(`/feed/posts/${postId}?auth_id=${authId}`);
  },

  // Update post
  async updatePost(postId: string, caption: string, image_url: string): Promise<Post> {
    const authId = await apiService.getAuthId();
    if (!authId) throw new Error('Not authenticated');
    return await apiService.put<Post>(`/feed/posts/${postId}?auth_id=${authId}`, { caption, image_url });
  },
};

// NOTE: review-related API calls live in src/services/review.service.ts
// (real reviewService, actually imported/used by the app). A dead duplicate
// `reviewService` export used to live here - removed to avoid two
// conflicting sources of truth for the same feature.