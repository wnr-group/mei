"use client";

import { useState } from "react";
import { useCartStore } from "@/store/cart";
import Input from "@/components/ui/Input";

interface CheckoutFormProps {
  onSubmitSuccess: (orderId: string) => void;
}

export default function CheckoutForm({ onSubmitSuccess }: CheckoutFormProps) {
  const clearCart = useCartStore((state) => state.clearCart);
  const total = useCartStore((state) => state.total);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) {
      setErrors((prev) => ({ ...prev, [id]: "" }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Full Name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^\d{10}$/.test(formData.phone.replace(/[\s-]/g, ""))) {
      newErrors.phone = "Invalid phone number (must be 10 digits)";
    }
    if (!formData.addressLine1.trim())
      newErrors.addressLine1 = "Address is required";
    if (!formData.city.trim()) newErrors.city = "City is required";
    if (!formData.state.trim()) newErrors.state = "State/Province is required";
    if (!formData.pincode.trim()) {
      newErrors.pincode = "Pincode/ZIP code is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);

    // Mock network request delay
    setTimeout(() => {
      setIsSubmitting(false);
      const mockOrderId = "MEI-" + Math.floor(100000 + Math.random() * 900000);
      clearCart();
      onSubmitSuccess(mockOrderId);
    }, 1500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 font-inter">
      <div className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#c9a465]">
          Contact Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            id="name"
            label="Full Name"
            placeholder="Aarav Sharma"
            value={formData.name}
            onChange={handleChange}
            error={errors.name}
          />
          <Input
            id="email"
            label="Email Address"
            type="email"
            placeholder="aarav@example.com"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
          />
        </div>
        <Input
          id="phone"
          label="Phone Number"
          type="tel"
          placeholder="9876543210"
          value={formData.phone}
          onChange={handleChange}
          error={errors.phone}
        />
      </div>

      <hr className="border-[#e8e0d5]/40" />

      <div className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#c9a465]">
          Atelier Delivery Address
        </h2>
        <Input
          id="addressLine1"
          label="Address Line 1"
          placeholder="Flat/House No, Building, Street"
          value={formData.addressLine1}
          onChange={handleChange}
          error={errors.addressLine1}
        />
        <Input
          id="addressLine2"
          label="Address Line 2 (Optional)"
          placeholder="Apartment, Landmark, Suite"
          value={formData.addressLine2}
          onChange={handleChange}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            id="city"
            label="City"
            placeholder="New Delhi"
            value={formData.city}
            onChange={handleChange}
            error={errors.city}
          />
          <Input
            id="state"
            label="State"
            placeholder="Delhi"
            value={formData.state}
            onChange={handleChange}
            error={errors.state}
          />
          <Input
            id="pincode"
            label="Pincode"
            placeholder="110024"
            value={formData.pincode}
            onChange={handleChange}
            error={errors.pincode}
          />
        </div>
      </div>

      <hr className="border-[#e8e0d5]/40" />

      <button
        type="submit"
        disabled={isSubmitting || total() === 0}
        className="w-full bg-[#1a1a1a] text-white py-4 text-xs font-semibold uppercase tracking-widest hover:bg-[#333333] transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
      >
        {isSubmitting ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Placing Couture Order...
          </>
        ) : (
          "Place Order"
        )}
      </button>
    </form>
  );
}
