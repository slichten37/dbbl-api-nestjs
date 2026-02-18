import { IsInt, IsUUID } from "class-validator";

export class CreateMatchDto {
  @IsUUID()
  homeTeamId: string;

  @IsUUID()
  awayTeamId: string;

  @IsUUID()
  seasonId: string;

  @IsInt()
  week: number;
}
