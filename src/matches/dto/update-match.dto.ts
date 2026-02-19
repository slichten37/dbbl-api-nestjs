import { PartialType } from "@nestjs/mapped-types";
import { CreateMatchDto } from "./create-match.dto";
import { IsInt, IsOptional, IsUUID } from "class-validator";

export class UpdateMatchDto extends PartialType(CreateMatchDto) {
  @IsOptional()
  @IsInt()
  homeTeamPoints?: number | null;

  @IsOptional()
  @IsInt()
  awayTeamPoints?: number | null;

  @IsOptional()
  @IsUUID()
  winningTeamId?: string | null;
}
