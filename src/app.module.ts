import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { BowlersModule } from "./bowlers";
import { MatchesModule } from "./matches";
import { PrismaModule } from "./prisma";
import { ScorecardAnalysisModule } from "./scorecard-analysis";
import { SeasonsModule } from "./seasons";
import { TeamsModule } from "./teams";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    BowlersModule,
    SeasonsModule,
    TeamsModule,
    MatchesModule,
    ScorecardAnalysisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
