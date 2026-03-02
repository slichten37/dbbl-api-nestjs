import { IsInt } from "class-validator";

export class SwitchWeeksDto {
  @IsInt()
  weekA: number;

  @IsInt()
  weekB: number;
}
