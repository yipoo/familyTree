"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PersonSearch } from "@/components/PersonSearch";

export function TreeHeaderSearch({ familyId }: { familyId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <div className="w-56">
      <PersonSearch
        familyId={familyId}
        placeholder="搜索人物 → 定位"
        clearOnPick
        historyKey={`tree-search:${familyId}`}
        onPick={(p) => {
          // 搜索 = 定位：保持全图渲染，仅把镜头平滑滚到该节点。
          // 清除 ?focus / ?root（避免子集视图导致目标不在 layout 中）。
          // ?locate 和 ?n 不参与 fetch 依赖，所以仅当 root/focus 变化时才会触发数据重拉。
          const sp = new URLSearchParams(params.toString());
          sp.delete("focus");
          sp.delete("root");
          sp.set("locate", p.id);
          sp.set("n", String(Date.now())); // nonce：相同人物再次搜索也能再次居中
          router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
        }}
      />
    </div>
  );
}
