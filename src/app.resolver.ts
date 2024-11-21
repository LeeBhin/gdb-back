import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { QueryRepository } from './neo4j/noe4j.service';
import {
  BoardComment,
  BoardPost,
  CommentReply,
  CommentWithReply,
  CreateBoardPost,
  GetBoardPosts,
} from './neo4j/post.type';

@Resolver(() => BoardPost)
export class AppResolver {
  constructor(private readonly queryRepository: QueryRepository) {}

  @Query(() => GetBoardPosts)
  async getBoardPosts(
    @Args('page') page: number,
    @Args('limit') limit: number,
  ): Promise<GetBoardPosts> {
    return await this.queryRepository.getBoardPosts(page, limit);
  }

  @Query(() => BoardPost)
  async getBoardPostById(@Args('id') id: string): Promise<BoardPost> {
    const result = await this.queryRepository.getBoardPostById(id);
    return result.posts[0];
  }

  @Mutation(() => CreateBoardPost)
  async createBoardPost(
    @Args('title') title: string,
    @Args('content') content: string,
    @Args('password') password: string,
  ): Promise<CreateBoardPost> {
    return await this.queryRepository.createBoardPost(title, content, password);
  }

  @Mutation(() => BoardComment)
  async addCommentToPost(
    @Args('postId') postId: string,
    @Args('content') content: string,
    @Args('password') password: string,
  ): Promise<BoardComment> {
    return await this.queryRepository.addCommentToPost(
      postId,
      content,
      password,
    );
  }

  @Query(() => [CommentWithReply])
  async getComments(
    @Args('postId') postId: string,
  ): Promise<CommentWithReply[]> {
    return await this.queryRepository.getComments(postId);
  }

  @Mutation(() => Boolean)
  async deleteComment(
    @Args('commentId') commentId: string,
    @Args('password') password: string,
  ): Promise<boolean> {
    return await this.queryRepository.deleteComment(commentId, password);
  }

  @Mutation(() => Boolean)
  async deletePost(
    @Args('postId') postId: string,
    @Args('password') password: string,
  ): Promise<boolean> {
    return await this.queryRepository.deletePost(postId, password);
  }

  @Mutation(() => CommentReply)
  async createReply(
    @Args('commentId') commentId: string,
    @Args('content') content: string,
    @Args('password') password: string,
    @Args('replyTo') replyTo: string,
  ): Promise<CommentReply> {
    return await this.queryRepository.createReply(
      commentId,
      content,
      password,
      replyTo,
    );
  }
}
