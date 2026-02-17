import { IsNotEmpty, IsString } from "class-validator";

export class CreateBowlerDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
