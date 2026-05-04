import { prisma } from "@/lib/db";

import { AdminSection } from "../_shared";
import { LocationsTable } from "./LocationsTable";

export const dynamic = "force-dynamic";

export default async function AdminLocationsPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;

  // Location 是全局表（无 familyId），但只展示被本家族任一引用过的
  const locations = await prisma.location.findMany({
    where: {
      OR: [
        { residents: { some: { familyId } } },
        { branches: { some: { familyId } } },
        { personLocations: { some: { person: { familyId } } } },
        { migrationsFrom: { some: { familyId } } },
        { migrationsTo: { some: { familyId } } },
      ],
    },
    include: {
      _count: {
        select: {
          residents: true,
          branches: true,
          personLocations: true,
          migrationsFrom: true,
          migrationsTo: true,
        },
      },
    },
    orderBy: [{ province: "asc" }, { city: "asc" }, { county: "asc" }, { village: "asc" }],
    take: 500,
  });

  const rows = locations.map((l) => ({
    id: l.id,
    province: l.province,
    city: l.city,
    county: l.county,
    town: l.town,
    village: l.village,
    detail: l.detail,
    fullText: l.fullText,
    refs: {
      residents: l._count.residents,
      branches: l._count.branches,
      personLocations: l._count.personLocations,
      migrations: l._count.migrationsFrom + l._count.migrationsTo,
    },
  }));

  return (
    <AdminSection
      title={`居住地字典（${rows.length}）`}
      description="本家族引用过的地点。可改名（重写省/市/县/镇/村，自动重建 fullText）、合并重复条目、删除未被引用的条目。"
    >
      <LocationsTable familyId={familyId} rows={rows} />
    </AdminSection>
  );
}
