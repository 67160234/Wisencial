import { IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ClassifyNewsDto } from './classify-news.dto';

export class ClassifyBatchNewsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'articles array must contain at least 1 article' })
  @ArrayMaxSize(50, { message: 'Maximum 50 articles per batch to avoid rate limits' })
  @ValidateNested({ each: true })
  @Type(() => ClassifyNewsDto)
  articles: ClassifyNewsDto[];
}
