import { Injectable, Inject } from '@nestjs/common';
import { NEO4J_CONNECTION } from './neo4j.constants';
import { Connection } from 'cypher-query-builder';
import {
  GetBoardPosts,
  CreateBoardPost,
  BoardComment,
  CommentWithReply,
} from './post.type';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

@Injectable()
export class QueryRepository {
  constructor(
    @Inject(NEO4J_CONNECTION)
    private readonly connection: Connection,
  ) {}

  async getBoardPosts(page: number, limit: number): Promise<GetBoardPosts> {
    try {
      const skip = (page - 1) * limit;

      const query = this.connection.query().raw(
        `MATCH (p:Post) 
         RETURN p.id AS id, p.title AS title, p.content AS content, p.createdAt AS createdAt
         ORDER BY p.createdAt DESC
         SKIP ${skip} LIMIT ${limit}`,
      );

      const results = await query.run();

      const posts = results.map((result) => ({
        id: result.id,
        title: result.title,
        content: result.content,
        createdAt: result.createdAt,
      }));

      const countQuery = this.connection
        .query()
        .raw(`MATCH (p:Post) RETURN count(p) AS totalCount`);

      const countResult = await countQuery.run();
      const totalCount = countResult[0].totalCount;

      return {
        posts,
        totalCount,
      };
    } catch (error) {
      console.error('Error:', error);
      throw new Error('Failed to fetch posts');
    }
  }

  async getBoardPostById(id: string): Promise<GetBoardPosts> {
    try {
      const query = this.connection.query().raw(
        `MATCH (p:Post {id: '${id}'}) 
         RETURN p.id AS id, p.title AS title, p.content AS content, p.createdAt AS createdAt`,
      );

      const result = await query.run();

      if (!result || result.length === 0) {
        throw new Error('Post not found');
      }

      const post = result[0];

      return {
        posts: [
          {
            id: post.id,
            title: post.title,
            content: post.content,
            createdAt: post.createdAt,
          },
        ],
        totalCount: 1,
      };
    } catch (error) {
      console.error('Error:', error);
      throw new Error('Failed to fetch post by id');
    }
  }

  async createBoardPost(
    title: string,
    content: string,
    password: string,
  ): Promise<CreateBoardPost> {
    try {
      const currentTime = new Date().toISOString();
      const id = uuidv4();

      const hashedPassword = await bcrypt.hash(password, 10);

      const query = this.connection.query().raw(
        `CREATE (p:Post {
          id: '${id}', 
          title: '${title}', 
          content: '${content}', 
          password: '${hashedPassword}',
          createdAt: '${currentTime}'
        })
         RETURN p.id AS id, p.title AS title, p.content AS content, p.createdAt AS createdAt`,
      );

      const result = await query.run();

      return {
        id: result[0].id,
        title: result[0].title,
        content: result[0].content,
        createdAt: result[0].createdAt,
      };
    } catch (error) {
      console.error('Error:', error);
      throw new Error('Failed to create post');
    }
  }

  onApplicationShutdown() {
    this.connection.close();
  }

  async addCommentToPost(
    postId: string,
    content: string,
    password: string,
  ): Promise<BoardComment> {
    try {
      const currentTime = new Date().toISOString();
      const commentId = uuidv4();

      const hashedPassword = await bcrypt.hash(password, 10);

      const query = this.connection.query().raw(
        `MATCH (p:Post {id: '${postId}'})
         CREATE (c:Comment {
           id: '${commentId}', 
           content: '${content}', 
           createdAt: '${currentTime}',
           password: '${hashedPassword}'
         })
         MERGE (p)-[:HAS_COMMENT]->(c)
         RETURN c.id AS id, c.content AS content, c.createdAt AS createdAt`,
      );

      const result = await query.run();

      return {
        id: result[0].id,
        content: result[0].content,
        createdAt: result[0].createdAt,
      };
    } catch (error) {
      console.error('Error:', error);
      throw new Error('Failed to add comment to post');
    }
  }

  async getComments(postId: string): Promise<CommentWithReply[]> {
    try {
      const escapedPostId = postId.replace(/'/g, "\\'");

      const query = this.connection.query().raw(`
        MATCH (p:Post {id: '${escapedPostId}'})-[d:HAS_COMMENT]->(c:Comment)
        OPTIONAL MATCH (c)-[:HAS_REPLY]->(r:Reply)
        RETURN {
          id: c.id, content: c.content, createdAt: c.createdAt, reply: false, parentId: null, depth: 0, replyTo: null
        } AS item
        UNION
        MATCH (p:Post {id: '${escapedPostId}'})-[:HAS_COMMENT]->(c:Comment)-[d:HAS_REPLY*]->(r:Reply)
        RETURN {
          id: r.id, content: r.content, createdAt: r.createdAt, reply: true, parentId: r.parentId, depth: SIZE(d), replyTo: COALESCE(r.replyTo, null)
        } AS item
        ORDER BY item.createdAt
      `);

      const results = await query.run();
      const sortedResults = results.map(({ item }) => ({ ...item }));

      const orderedComments: CommentWithReply[] = [];

      const topLevelComments = sortedResults.filter(
        (item) => item.parentId === null,
      );
      orderedComments.push(...topLevelComments);

      const remainingComments = sortedResults.filter(
        (item) => item.parentId !== null,
      );

      for (const comment of remainingComments) {
        const parentIndex = orderedComments.findIndex(
          (item) => item.id === comment.parentId,
        );

        if (parentIndex !== -1) {
          orderedComments.splice(parentIndex + 1, 0, comment);
        } else {
          orderedComments.push(comment);
        }
      }

      return orderedComments;
    } catch (error) {
      console.error('Error fetching comments:', error);
      throw new Error('Failed to fetch comments and replies');
    }
  }
  async deleteComment(commentId: string, password: string): Promise<any> {
    try {
      const query = this.connection.query().raw(
        `MATCH (n) 
         WHERE n.id = '${commentId}' AND (n:Comment OR n:Reply) 
         RETURN n.password AS password`,
      );

      const result = await query.run();

      if (result.length === 0) {
        throw new Error('Comment not found');
      }

      const storedPassword = result[0].password;
      const isPasswordValid = await bcrypt.compare(password, storedPassword);

      if (!isPasswordValid) {
        throw new Error('Invalid password');
      }
      const deleteQuery = this.connection.query().raw(
        `MATCH (n) 
         WHERE n.id = '${commentId}' AND (n:Comment OR n:Reply)
         DETACH DELETE n`,
      );

      await deleteQuery.run();

      return true;
    } catch (error) {
      console.error('Error:', error);
      throw new Error('Failed to delete comment');
    }
  }

  async deletePost(postId: string, password: string): Promise<any> {
    try {
      const query = this.connection.query().raw(
        `MATCH (p:Post {id: '${postId}'})
         OPTIONAL MATCH (p)-[r]->(n) 
         RETURN p.password AS password`,
      );

      const result = await query.run();

      const storedPassword = result[0]?.password;

      const isPasswordValid = await bcrypt.compare(
        password,
        storedPassword || '',
      );

      if (!isPasswordValid) {
        throw new Error('Invalid password');
      }

      const deleteQuery = this.connection.query().raw(
        `MATCH (p:Post {id: '${postId}'}) 
         OPTIONAL MATCH (p)-[r]->(n) 
         DETACH DELETE p, n, r`,
      );

      await deleteQuery.run();

      return true;
    } catch (error) {
      console.error('Error:', error);
      throw new Error('Failed to delete post and its related nodes');
    }
  }

  async createReply(
    commentId: string,
    content: string,
    password: string,
    replyTo: string,
  ): Promise<BoardComment> {
    try {
      const currentTime = new Date().toISOString();
      const replyId = uuidv4();
      const hashedPassword = await bcrypt.hash(password, 10);

      const query = this.connection.query().raw(
        `MATCH (parent)
         WHERE (parent:Comment OR parent:Reply) AND parent.id = $commentId
         CREATE (r:Reply {
           id: $replyId, 
           content: $content, 
           createdAt: $currentTime,
           password: $hashedPassword,
           replyTo: $replyTo,
           parentId:$commentId
         })
         MERGE (parent)-[:HAS_REPLY]->(r)
         RETURN r.id AS id, r.content AS content, r.createdAt AS createdAt`,
        {
          commentId,
          replyId,
          content,
          currentTime,
          hashedPassword,
          replyTo,
        },
      );
      const result = await query.run();

      if (!result.length) {
        throw new Error(`No Comment or Reply found with id ${commentId}`);
      }

      return {
        id: result[0].id,
        content: result[0].content,
        createdAt: result[0].createdAt,
      };
    } catch (error) {
      console.error('Error creating reply:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to create reply',
      );
    }
  }
}
