// src/app/shop/[slug]/loading.tsx
export default function ProductDetailLoading() {
  return (
    <main className="flex-1 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="h-3 w-48 bg-[#e8e0d5] rounded animate-pulse" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div className="aspect-[3/4] w-full bg-[#e8e0d5] animate-pulse" />
          <div className="space-y-6 pt-2">
            <div className="h-3 w-20 bg-[#e8e0d5] rounded animate-pulse" />
            <div className="h-10 w-3/4 bg-[#e8e0d5] rounded animate-pulse" />
            <div className="h-6 w-1/3 bg-[#e8e0d5] rounded animate-pulse" />
            <div className="space-y-2 pt-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-3 w-full bg-[#e8e0d5] rounded animate-pulse" />
              ))}
            </div>
            <div className="h-12 w-full bg-[#e8e0d5] animate-pulse mt-6" />
          </div>
        </div>
      </div>
    </main>
  );
}
