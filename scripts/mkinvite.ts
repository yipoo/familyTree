import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { generateInviteCode } from "../lib/services/invites";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const fid = "cmol9qaxz0001mi2foautenf3";
  const owner = await prisma.user.findFirst({ where: { phone: "13800000000" } });
  if (!owner) throw new Error("superadmin not found");
  const inv = await prisma.familyInvite.create({
    data: {
      familyId: fid,
      code: generateInviteCode(),
      role: "MEMBER",
      maxUses: null,
      expiresAt: new Date(Date.now() + 30 * 86400000),
      createdById: owner.id,
      note: "test invite",
    },
  });
  console.log("code:", inv.code, " URL: /join/" + inv.code);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
