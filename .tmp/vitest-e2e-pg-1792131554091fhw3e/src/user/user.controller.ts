import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode, BadRequestException } from '@nestjs/common';
import { UserService, UserInterface } from './user.service';

@Controller()
export class UserController {
  constructor(private readonly service: UserService) {}

  @Post('users')
  @HttpCode(201)
  async post_user(@Body() payload: Partial<UserInterface>) {
    return await this.service.createRecord(payload);
  }

  @Delete('users/:id')
  async delete_user_by_id(@Param('id') id: string) {
    await this.service.deleteRecord(id);
  }

  @Get('users/:id')
  async get_user_by_id(@Param('id') id: string) {
    return await this.service.readOne(id);
  }
}
