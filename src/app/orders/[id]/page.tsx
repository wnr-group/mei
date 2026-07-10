import Link from "next/link";
import type { Metadata } from "next";
import { getOrderById } from "@/lib/services/orders-server";
import { formatCurrency } from "@/lib/utils/format";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "In Production",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) {
    return (
      <main className="flex-1 bg-white min-h-[60vh] flex items-center justify-center font-inter">
        <div className="text-center space-y-4 px-4">
          <h1 className="text-2xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
            Order Not Found
          </h1>
          <p className="text-sm text-[#9a9a9a]">
            This order reference is invalid or may have been removed.
          </p>
          <Link
            href="/shop"
            className="inline-block text-xs uppercase tracking-widest font-bold text-[#c9a465] border-b border-[#c9a465] pb-0.5 hover:text-[#d4b87a] transition-all"
          >
            Browse Collection
          </Link>
        </div>
      </main>
    );
  }

  const itemsSubtotal = order.items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );
  const shipping = order.total - itemsSubtotal;
  const addr = order.shipping_address;

  return (
    <main className="flex-1 bg-white py-16 font-inter">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Page header */}
        <div className="border-b border-[#e8e0d5] pb-6 space-y-1">
          <p className="text-xs uppercase tracking-widest font-bold text-[#9a9a9a]">
            Order Details
          </p>
          <h1 className="text-3xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
            {order.order_number}
          </h1>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <span className="text-xs text-[#9a9a9a]">
              Placed on {formatDate(order.created_at)}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-[#c9a465]">
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: items + pricing */}
          <div className="bg-[#faf8f5] border border-[#e8e0d5] p-6 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
              Items Ordered
            </h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start gap-4">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-[#1a1a1a] leading-tight">
                      {item.product_name}
                    </p>
                    {item.color_label && (
                      <p className="text-xs text-[#c9a465] uppercase tracking-widest font-semibold">
                        {item.color_label}
                      </p>
                    )}
                    <p className="text-xs text-[#9a9a9a] uppercase tracking-wider">
                      QTY: {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[#1a1a1a] whitespace-nowrap">
                    {formatCurrency(item.unit_price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
            <hr className="border-[#e8e0d5]" />
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-[#4a4a4a]">
                <span className="uppercase tracking-widest font-bold">Subtotal</span>
                <span>{formatCurrency(itemsSubtotal)}</span>
              </div>
              <div className="flex justify-between text-[#4a4a4a]">
                <span className="uppercase tracking-widest font-bold">Shipping</span>
                {shipping === 0 ? (
                  <span className="text-[#c9a465] uppercase font-bold tracking-widest">Free</span>
                ) : (
                  <span>{formatCurrency(shipping)}</span>
                )}
              </div>
            </div>
            <hr className="border-[#e8e0d5]" />
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold uppercase tracking-widest text-[#1a1a1a]">
                Total
              </span>
              <span className="text-lg font-light text-[#1a1a1a]">
                {formatCurrency(order.total)}
              </span>
            </div>
          </div>

          {/* Right: customer + shipping + payment */}
          <div className="space-y-6">
            {order.customer && (
              <div className="bg-[#faf8f5] border border-[#e8e0d5] p-6 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
                  Customer
                </h2>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-[#1a1a1a]">{order.customer.name}</p>
                  {order.customer.email && (
                    <p className="text-sm text-[#4a4a4a]">{order.customer.email}</p>
                  )}
                  {order.customer.phone && (
                    <p className="text-sm text-[#4a4a4a]">{order.customer.phone}</p>
                  )}
                </div>
              </div>
            )}

            {addr && (
              <div className="bg-[#faf8f5] border border-[#e8e0d5] p-6 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
                  Shipping Address
                </h2>
                <address className="not-italic text-sm text-[#4a4a4a] leading-relaxed">
                  {addr.addressLine1 && <span className="block">{addr.addressLine1}</span>}
                  {addr.addressLine2 && <span className="block">{addr.addressLine2}</span>}
                  {(addr.city || addr.state) && (
                    <span className="block">
                      {[addr.city, addr.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {addr.pincode && <span className="block">{addr.pincode}</span>}
                  {addr.country && <span className="block">{addr.country}</span>}
                </address>
              </div>
            )}

            {(order.payment_id || order.payment_metadata?.razorpay_order_id) && (
              <div className="bg-[#faf8f5] border border-[#e8e0d5] p-6 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
                  Payment
                </h2>
                <div className="space-y-2">
                  {order.payment_provider && (
                    <p className="text-xs uppercase tracking-widest font-bold text-[#c9a465]">
                      {order.payment_provider}
                    </p>
                  )}
                  {order.payment_id && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-[#9a9a9a] uppercase tracking-wider font-bold">
                        Payment ID
                      </p>
                      <p className="text-xs text-[#4a4a4a] font-mono break-all">
                        {order.payment_id}
                      </p>
                    </div>
                  )}
                  {order.payment_metadata?.razorpay_order_id && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-[#9a9a9a] uppercase tracking-wider font-bold">
                        Order Reference
                      </p>
                      <p className="text-xs text-[#4a4a4a] font-mono break-all">
                        {order.payment_metadata.razorpay_order_id}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back link */}
        <div className="pt-4">
          <Link
            href="/shop"
            className="text-xs uppercase tracking-widest font-bold text-[#c9a465] border-b border-[#c9a465] pb-0.5 hover:text-[#d4b87a] transition-all"
          >
            Continue Browsing
          </Link>
        </div>
      </div>
    </main>
  );
}
