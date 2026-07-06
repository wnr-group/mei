export default function OrderDetailLoading() {
  return (
    <main className="flex-1 bg-white py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="border-b border-[#e8e0d5] pb-6 space-y-3">
          <div className="h-2.5 w-24 bg-[#e8e0d5] rounded animate-pulse" />
          <div className="h-9 w-48 bg-[#e8e0d5] rounded animate-pulse" />
          <div className="h-2.5 w-64 bg-[#e8e0d5] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="bg-[#faf8f5] border border-[#e8e0d5] p-6 space-y-4">
            <div className="h-2.5 w-24 bg-[#e8e0d5] rounded animate-pulse" />
            {[0, 1].map((i) => (
              <div key={i} className="flex justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 w-40 bg-[#e8e0d5] rounded animate-pulse" />
                  <div className="h-2.5 w-16 bg-[#e8e0d5] rounded animate-pulse" />
                </div>
                <div className="h-3 w-20 bg-[#e8e0d5] rounded animate-pulse flex-shrink-0" />
              </div>
            ))}
            <hr className="border-[#e8e0d5]" />
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-2.5 w-16 bg-[#e8e0d5] rounded animate-pulse" />
                <div className="h-2.5 w-20 bg-[#e8e0d5] rounded animate-pulse" />
              </div>
              <div className="flex justify-between">
                <div className="h-2.5 w-16 bg-[#e8e0d5] rounded animate-pulse" />
                <div className="h-2.5 w-12 bg-[#e8e0d5] rounded animate-pulse" />
              </div>
            </div>
            <hr className="border-[#e8e0d5]" />
            <div className="flex justify-between">
              <div className="h-3 w-12 bg-[#e8e0d5] rounded animate-pulse" />
              <div className="h-5 w-24 bg-[#e8e0d5] rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-[#faf8f5] border border-[#e8e0d5] p-6 space-y-3">
                <div className="h-2.5 w-20 bg-[#e8e0d5] rounded animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-3 w-36 bg-[#e8e0d5] rounded animate-pulse" />
                  <div className="h-3 w-48 bg-[#e8e0d5] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
