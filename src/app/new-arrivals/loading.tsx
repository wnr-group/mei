// src/app/new-arrivals/loading.tsx
export default function NewArrivalsLoading() {
  return (
    <main className="flex-1 bg-white min-h-screen">
      <div className="bg-[#1a1a1a] py-32 flex flex-col justify-center items-center gap-4">
        <div className="h-3 w-32 bg-white/30 rounded animate-pulse" />
        <div className="h-10 w-48 bg-white/30 rounded animate-pulse" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
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
