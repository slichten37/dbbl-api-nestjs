import { Module } from "@nestjs/common";
import { BowlersController } from "./bowlers.controller";
import { BowlersService } from "./bowlers.service";

@Module({
  controllers: [BowlersController],
  providers: [BowlersService],
  exports: [BowlersService],
})
export class BowlersModule {}
