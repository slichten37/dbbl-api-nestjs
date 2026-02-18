import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class FrameScoreDto {
  @IsInt()
  @Min(1)
  @Max(10)
  frameNumber: number;

  @IsInt()
  @Min(0)
  @Max(10)
  ball1Score: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  ball2Score: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  ball3Score: number | null;

  @IsBoolean()
  isBall1Split: boolean;
}

export class BowlerScoresDto {
  @IsUUID()
  bowlerId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FrameScoreDto)
  frames: FrameScoreDto[];
}

export class SubmitScoresDto {
  @IsInt()
  @Min(1)
  @Max(3)
  gameNumber: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BowlerScoresDto)
  bowlers: BowlerScoresDto[];
}
