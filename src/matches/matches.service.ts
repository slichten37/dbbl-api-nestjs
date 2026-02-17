import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma";
import { CreateMatchDto } from "./dto/create-match.dto";
import { UpdateMatchDto } from "./dto/update-match.dto";

const matchIncludes = {
  team1: true,
  team2: true,
  season: true,
  frames: true,
};

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.match.findMany({
      include: matchIncludes,
    });
  }

  async findOne(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: matchIncludes,
    });
    if (!match) {
      throw new NotFoundException(`Match with id ${id} not found`);
    }
    return match;
  }

  create(dto: CreateMatchDto) {
    return this.prisma.match.create({
      data: dto,
      include: matchIncludes,
    });
  }

  async update(id: string, dto: UpdateMatchDto) {
    await this.findOne(id);
    return this.prisma.match.update({
      where: { id },
      data: dto,
      include: matchIncludes,
    });
  }
}
