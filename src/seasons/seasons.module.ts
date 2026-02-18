import { Module } from "@nestjs/common";
import { SeasonsController } from "./seasons.controller";
import { SeasonsService } from "./seasons.service";
import { MatchesModule } from "../matches/matches.module";

@Module({
  imports: [MatchesModule],
  controllers: [SeasonsController],
  providers: [SeasonsService],
  exports: [SeasonsService],
})
export class SeasonsModule {}
