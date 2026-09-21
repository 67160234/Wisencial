import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { NewsClassifierService } from './news-classifier.service';
import { ClassifyNewsDto } from './dto/classify-news.dto';
import { ClassifyBatchNewsDto } from './dto/classify-batch-news.dto';
import { ClassifyNewsResponseDto, BatchClassifyNewsResponseDto } from './dto/classify-news-response.dto';

@Controller('ai/news')
export class NewsClassifierController {
  constructor(private readonly newsClassifierService: NewsClassifierService) {}

  @Post('classify')
  @HttpCode(HttpStatus.OK)
  async classify(@Body() dto: ClassifyNewsDto): Promise<ClassifyNewsResponseDto> {
    return await this.newsClassifierService.classify(dto);
  }

  @Post('classify-batch')
  @HttpCode(HttpStatus.OK)
  async classifyBatch(@Body() dto: ClassifyBatchNewsDto): Promise<BatchClassifyNewsResponseDto> {
    return await this.newsClassifierService.classifyBatch(dto.articles);
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  health() {
    return this.newsClassifierService.healthCheck();
  }
}
