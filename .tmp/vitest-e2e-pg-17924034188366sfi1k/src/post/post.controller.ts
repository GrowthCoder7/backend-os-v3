import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode, BadRequestException } from '@nestjs/common';
import { PostService, PostInterface } from './post.service';

@Controller()
export class PostController {
  constructor(private readonly service: PostService) {}

  @Get('posts')
  async get_post() {
    return await this.service.readAll();
  }

  @Post('posts')
  @HttpCode(201)
  async post_post(@Body() payload: Partial<PostInterface>) {
    return await this.service.createRecord(payload);
  }

  @Delete('posts/:id')
  async delete_post_by_id(@Param('id') id: string) {
    await this.service.deleteRecord(id);
  }

  @Get('posts/:id')
  async get_post_by_id(@Param('id') id: string) {
    return await this.service.readOne(id);
  }
}
