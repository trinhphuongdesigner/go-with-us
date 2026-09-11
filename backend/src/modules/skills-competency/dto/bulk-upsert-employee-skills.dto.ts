import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { EmployeeSkillItemDto } from './employee-skill-item.dto';

/**
 * Body shape for PUT /skills-competency/users/:userId/skills — a plain
 * array body would also work via a ParseArrayPipe, but wrapping it keeps
 * this consistent with every other DTO in this module (and with
 * ValidationPipe's whitelist:true, which only strips unknown *object*
 * keys — an array-root body bypasses that entirely).
 */
export class BulkUpsertEmployeeSkillsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmployeeSkillItemDto)
  skills!: EmployeeSkillItemDto[];
}
