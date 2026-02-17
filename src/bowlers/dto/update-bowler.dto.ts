import { PartialType } from "@nestjs/mapped-types";
import { CreateBowlerDto } from "./create-bowler.dto";

export class UpdateBowlerDto extends PartialType(CreateBowlerDto) {}
