import apiService from './api';
import { Post, Comment, PaginatedResponse } from '../types';

const normalizePostModeration = (post: Partial<Post> & { approved?: boolean; moderation_status?: string; status?: string }) => {
  const candidate = (post.moderation_status || post.status || '').toLowerCase();
  if (post.is_active === true || post.approved === true || candidate === 'approved') return 'approved';
  if (post.is_active === false || post.approved === false || candidate === 'rejected') return 'rejected';
  return 'pending';
};

const isPubliclyVisiblePost = (post: Partial<Post> & { approved?: boolean; moderation_status?: string; status?: string }) => {
  return normalizePostModeration(post) === 'approved';
};

export const feedService = {
  // Get feed posts. Web backend returns { posts: [...], total, limit, offset }
  async getFeed(params?: { page?: number; per_page?: number }): Promise<PaginatedResponse<Post>> {
    const response = await apiService.get<any>('/feed/posts', { params });
    const posts = Array.isArray(response?.posts) ? response.posts : Array.isArray(response?.data) ? response.data : [];
    // Only show posts that are explicitly approved in the public UI.
    return {
      data: posts.filter(isPubliclyVisiblePost),
      total: response.total || posts.length || 0,
      page: params?.page || 1,
      per_page: params?.per_page || 20,
      total_pages: Math.ceil((response.total || posts.length || 0) / (params?.per_page || 20)),
    };
  },

  async getModerationPosts(params?: { page?: number; per_page?: number }): Promise<PaginatedResponse<Post>> {
    const response = await apiService.get<any>('/feed/posts', { params });
    const posts = Array.isArray(response?.posts) ? response.posts : Array.isArray(response?.data) ? response.data : [];
    return {
      data: posts.filter((post: any) => normalizePostModeration(post) !== 'approved'),
      total: response.total || posts.length || 0,
      page: params?.page || 1,
      per_page: params?.per_page || 20,
      total_pages: Math.ceil((response.total || posts.length || 0) / (params?.per_page || 20)),
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

  async reportPost(postId: string, reason: string): Promise<void> {
    await apiService.post('/feed/report', { postId, reason });
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

  async updatePostModeration(postId: string, action: 'approve' | 'reject'): Promise<void> {
    const authId = await apiService.getAuthId();
    if (!authId) throw new Error('Not authenticated');
    const nextStatus = action === 'approve' ? 'approved' : 'rejected';
    await apiService.put(`/feed/posts/${postId}?auth_id=${authId}`, {
      is_active: action === 'approve',
      moderation_status: nextStatus,
      status: nextStatus,
    });
  },
};

// NOTE: review-related API calls live in src/services/review.service.ts
// (real reviewService, actually imported/used by the app). A dead duplicate
// `reviewService` export used to live here - removed to avoid two
// conflicting sources of truth for the same feature.