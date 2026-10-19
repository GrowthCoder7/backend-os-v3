import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException, HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface PostInterface {
  authorId: string;
  id: string;
  title: string;
}

@Injectable()
export class PostService {
  constructor(private prisma: PrismaService) {}

  private handleError(error: unknown) {
    if (error instanceof HttpException) throw error; 
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictException('Unique constraint violation.');
      if (error.code === 'P2025') throw new NotFoundException('Record not found.');
    }
    console.error('[Prisma Error]', error);
    throw new InternalServerErrorException('Database operation failed.');
  }

  async createRecord(payload: Partial<PostInterface>): Promise<PostInterface> {
    const requiredFields = ["authorId","title"];
    for (const field of requiredFields) {
      if ((payload as Record<string, unknown>)[field] === undefined) {
        throw new BadRequestException(`Field '${field}' is required.`);
      }
    }
    
    try {
      return await this.prisma.post.create({ data: payload as any }) as unknown as PostInterface;
    } catch (error) {
      this.handleError(error);
    }
    throw new InternalServerErrorException();
  }

  async readAll(): Promise<PostInterface[]> {
    try {
      return await this.prisma.post.findMany() as unknown as PostInterface[];
    } catch (error) {
      this.handleError(error);
    }
    return [];
  }

  async readOne(id: string): Promise<PostInterface> {
    const parsedId = id;
    

    try {
      const record = await this.prisma.post.findUnique({ where: { id: parsedId } });
      if (!record) throw new NotFoundException(); 
      return record as unknown as PostInterface;
    } catch (error) {
      this.handleError(error);
    }
    throw new InternalServerErrorException();
  }

  async updateRecord(id: string, payload: Partial<PostInterface>): Promise<PostInterface> {
    const parsedId = id;
    

    try {
      return await this.prisma.post.update({
        where: { id: parsedId },
        data: payload as any,
      }) as unknown as PostInterface;
    } catch (error) {
      this.handleError(error);
    }
    throw new InternalServerErrorException();
  }

  async deleteRecord(id: string): Promise<void> {
    const parsedId = id;
    

    try {
      await this.prisma.post.delete({ where: { id: parsedId } });
    } catch (error) {
      this.handleError(error);
    }
  }
}
