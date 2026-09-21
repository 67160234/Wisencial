import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class ClassifyNewsDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  article_id?: string;

  @IsNotEmpty({ message: 'title is required' })
  @IsString()
  @MaxLength(1200, { message: 'title cannot exceed 1200 characters' })
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'description cannot exceed 2000 characters' })
  description?: string;
}
