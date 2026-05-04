import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const token = "test_share_token_abc123";
  const fid = "cmol9qaxz0001mi2foautenf3";
  await prisma.shareLink.deleteMany({ where: { token } });
  await prisma.shareLink.create({
    data: { familyId: fid, token, scope: { kind: "all" }, createdBy: "system" },
  });
  console.log("share token:", token);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
