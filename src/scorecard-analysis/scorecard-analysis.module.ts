import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScorecardAnalysisService } from "./scorecard-analysis.service";

@Module({
  imports: [ConfigModule],
  providers: [ScorecardAnalysisService],
  exports: [ScorecardAnalysisService],
})
export class ScorecardAnalysisModule {}
