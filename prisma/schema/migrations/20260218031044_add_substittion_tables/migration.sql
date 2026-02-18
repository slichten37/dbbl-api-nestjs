-- CreateTable
CREATE TABLE "MatchSubstitution" (
    "id" TEXT NOT NULL,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,
    "matchId" TEXT NOT NULL,
    "originalBowlerId" TEXT NOT NULL,
    "substituteBowlerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "MatchSubstitution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchSubstitution_matchId_originalBowlerId_key" ON "MatchSubstitution"("matchId", "originalBowlerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchSubstitution_matchId_substituteBowlerId_key" ON "MatchSubstitution"("matchId", "substituteBowlerId");

-- AddForeignKey
ALTER TABLE "MatchSubstitution" ADD CONSTRAINT "MatchSubstitution_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSubstitution" ADD CONSTRAINT "MatchSubstitution_originalBowlerId_fkey" FOREIGN KEY ("originalBowlerId") REFERENCES "Bowler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSubstitution" ADD CONSTRAINT "MatchSubstitution_substituteBowlerId_fkey" FOREIGN KEY ("substituteBowlerId") REFERENCES "Bowler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSubstitution" ADD CONSTRAINT "MatchSubstitution_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
