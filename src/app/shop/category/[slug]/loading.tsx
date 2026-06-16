// src/app/shop/category/[slug]/loading.tsx
export default function CategoryLoading() {
  return (
    <main className="flex-1 bg-white min-h-screen">
      <div className="bg-[#a69c90] py-28 flex flex-col justify-center items-center gap-3">
        <div className="h-3 w-32 bg-white/30 rounded animate-pulse" />
        <div className="h-10 w-56 bg-white/30 rounded animate-pulse" />
      </div>
      <div className="border-b border-[#e8e0d5]/60 py-6 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 w-24 bg-[#e8e0d5] rounded animate-pulse" />
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-[3/4] w-full bg-[#e8e0d5] animate-pulse" />
              <div className="h-4 w-3/4 bg-[#e8e0d5] rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-[#e8e0d5] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
