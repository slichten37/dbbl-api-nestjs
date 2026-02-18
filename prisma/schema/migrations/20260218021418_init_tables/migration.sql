-- CreateTable
CREATE TABLE "Bowler" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bowler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Frame" (
    "id" TEXT NOT NULL,
    "frameNumber" INTEGER NOT NULL,
    "ball1Score" INTEGER NOT NULL,
    "ball2Score" INTEGER,
    "ball3Score" INTEGER,
    "isBall1Split" BOOLEAN NOT NULL DEFAULT false,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,
    "gameId" TEXT NOT NULL,
    "bowlerId" TEXT NOT NULL,

    CONSTRAINT "Frame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "gameNumber" INTEGER NOT NULL,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,
    "matchId" TEXT NOT NULL,
    "homeTeamScore" INTEGER,
    "awayTeamScore" INTEGER,
    "homeTeamStrikes" INTEGER,
    "awayTeamStrikes" INTEGER,
    "homeTeamPoints" INTEGER,
    "awayTeamPoints" INTEGER,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "winningTeamId" TEXT,
    "homeTeamPoints" INTEGER,
    "awayTeamPoints" INTEGER,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUtc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BowlerToTeam" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BowlerToTeam_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_SeasonToTeam" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SeasonToTeam_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Frame_gameId_bowlerId_frameNumber_key" ON "Frame"("gameId", "bowlerId", "frameNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Game_matchId_gameNumber_key" ON "Game"("matchId", "gameNumber");

-- CreateIndex
CREATE INDEX "_BowlerToTeam_B_index" ON "_BowlerToTeam"("B");

-- CreateIndex
CREATE INDEX "_SeasonToTeam_B_index" ON "_SeasonToTeam"("B");

-- AddForeignKey
ALTER TABLE "Frame" ADD CONSTRAINT "Frame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Frame" ADD CONSTRAINT "Frame_bowlerId_fkey" FOREIGN KEY ("bowlerId") REFERENCES "Bowler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winningTeamId_fkey" FOREIGN KEY ("winningTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BowlerToTeam" ADD CONSTRAINT "_BowlerToTeam_A_fkey" FOREIGN KEY ("A") REFERENCES "Bowler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BowlerToTeam" ADD CONSTRAINT "_BowlerToTeam_B_fkey" FOREIGN KEY ("B") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SeasonToTeam" ADD CONSTRAINT "_SeasonToTeam_A_fkey" FOREIGN KEY ("A") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SeasonToTeam" ADD CONSTRAINT "_SeasonToTeam_B_fkey" FOREIGN KEY ("B") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
