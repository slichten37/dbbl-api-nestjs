import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { SeasonsService } from "./seasons.service";
import { CreateSeasonDto } from "./dto/create-season.dto";
import { UpdateSeasonDto } from "./dto/update-season.dto";

@Controller("seasons")
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Get()
  findAll() {
    return this.seasonsService.findAll();
  }

  @Get("active")
  findActive() {
    return this.seasonsService.findActive();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.seasonsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSeasonDto) {
    return this.seasonsService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateSeasonDto) {
    return this.seasonsService.update(id, dto);
  }

  @Post(":id/generate-schedule")
  generateSchedule(@Param("id") id: string) {
    return this.seasonsService.generateSchedule(id);
  }
}
