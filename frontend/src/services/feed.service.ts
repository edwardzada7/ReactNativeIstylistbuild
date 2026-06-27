import apiService from './api';
import { Post, Comment, Review, CreateReviewRequest, PaginatedResponse } from '../types';

export const feedService = {
  // Get feed posts
  async getFeed(params?: { page?: number; per_page?: number }): Promise<PaginatedResponse<Post>> {
    return await apiService.get<PaginatedResponse<Post>>('/feed', { params });
  },

  // Create post
  async createPost(content: string, images?: string[]): Promise<Post> {
    return await apiService.post<Post>('/feed', { content, images });
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

export const reviewService = {
  // Get provider reviews
  async getProviderReviews(
    providerId: string,
    params?: { page?: number; per_page?: number }
  ): Promise<PaginatedResponse<Review>> {
    return await apiService.get<PaginatedResponse<Review>>(`/reviews/provider/${providerId}`, {
      params,
    });
  },

  // Create review
  async createReview(data: CreateReviewRequest): Promise<Review> {
    return await apiService.post<Review>('/reviews', data);
  },

  // Get my reviews
  async getMyReviews(params?: { page?: number; per_page?: number }): Promise<PaginatedResponse<Review>> {
    return await apiService.get<PaginatedResponse<Review>>('/reviews/me', { params });
  },
};