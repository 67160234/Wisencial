import { Module } from '@nestjs/common';
import { NewsClassifierController } from './news-classifier.controller';
import { NewsClassifierService } from './news-classifier.service';

@Module({
  controllers: [NewsClassifierController],
  providers: [NewsClassifierService],
  exports: [NewsClassifierService],
})
export class NewsClassifierModule {}
