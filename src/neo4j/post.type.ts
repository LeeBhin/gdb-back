import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class BoardPost {
  @Field()
  id: string;

  @Field()
  title: string;

  @Field()
  content: string;

  @Field()
  createdAt: string;
}

@ObjectType()
export class CreateBoardPost {
  @Field()
  id: string;

  @Field()
  title: string;

  @Field()
  content: string;

  @Field()
  createdAt: string;
}

@ObjectType()
export class GetBoardPosts {
  @Field(() => [BoardPost])
  posts: BoardPost[];

  @Field(() => Int)
  totalCount: number;
}

@ObjectType()
export class BoardComment {
  @Field()
  id: string;

  @Field()
  content: string;

  @Field()
  createdAt: string;
}

@ObjectType()
export class CommentReply {
  @Field()
  id: string;

  @Field()
  content: string;

  @Field()
  createdAt: string;

  @Field({ nullable: true })
  replyTo?: string;
}

@ObjectType()
export class CommentWithReply {
  @Field()
  id: string;

  @Field()
  content: string;

  @Field()
  createdAt: string;

  @Field()
  reply: boolean;

  @Field({ nullable: true })
  parentId?: string;

  @Field()
  depth: number;

  @Field({ nullable: true })
  replyTo: string;
}
