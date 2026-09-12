import { IsString, MinLength } from 'class-validator';

export class AddCompanyMemberDto {
  @IsString()
  @MinLength(1)
  userId!: string;
}
