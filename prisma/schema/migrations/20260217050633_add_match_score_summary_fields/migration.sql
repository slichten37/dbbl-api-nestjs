-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "team1Score" INTEGER,
ADD COLUMN     "team1Strikes" INTEGER,
ADD COLUMN     "team2Score" INTEGER,
ADD COLUMN     "team2Strikes" INTEGER,
ADD COLUMN     "winningTeamId" TEXT;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winningTeamId_fkey" FOREIGN KEY ("winningTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
