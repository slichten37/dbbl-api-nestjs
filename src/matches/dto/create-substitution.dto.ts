import { IsUUID } from "class-validator";

export class CreateSubstitutionDto {
  @IsUUID()
  originalBowlerId: string;

  @IsUUID()
  substituteBowlerId: string;

  @IsUUID()
  teamId: string;
}
