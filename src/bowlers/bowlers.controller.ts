import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { BowlersService } from "./bowlers.service";
import { CreateBowlerDto } from "./dto/create-bowler.dto";
import { UpdateBowlerDto } from "./dto/update-bowler.dto";

@Controller("bowlers")
export class BowlersController {
  constructor(private readonly bowlersService: BowlersService) {}

  @Get()
  findAll() {
    return this.bowlersService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.bowlersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBowlerDto) {
    return this.bowlersService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateBowlerDto) {
    return this.bowlersService.update(id, dto);
  }
}
