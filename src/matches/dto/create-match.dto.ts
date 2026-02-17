import { IsInt, IsUUID } from "class-validator";

export class CreateMatchDto {
  @IsUUID()
  team1Id: string;

  @IsUUID()
  team2Id: string;

  @IsUUID()
  seasonId: string;

  @IsInt()
  week: number;
}
