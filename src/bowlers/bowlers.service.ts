import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma";
import { CreateBowlerDto } from "./dto/create-bowler.dto";
import { UpdateBowlerDto } from "./dto/update-bowler.dto";

@Injectable()
export class BowlersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.bowler.findMany({
      include: { teams: true },
    });
  }

  async findOne(id: string) {
    const bowler = await this.prisma.bowler.findUnique({
      where: { id },
      include: { teams: true },
    });
    if (!bowler) {
      throw new NotFoundException(`Bowler with id ${id} not found`);
    }
    return bowler;
  }

  create(dto: CreateBowlerDto) {
    return this.prisma.bowler.create({
      data: dto,
      include: { teams: true },
    });
  }

  async update(id: string, dto: UpdateBowlerDto) {
    await this.findOne(id);
    return this.prisma.bowler.update({
      where: { id },
      data: dto,
      include: { teams: true },
    });
  }
}
