"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { submitEnquiry } from "./actions";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    occasion: "",
    budget: "",
    message: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) {
      setErrors((prev) => ({ ...prev, [id]: "" }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    }
    if (!formData.occasion) {
      newErrors.occasion = "Please select an occasion";
    }
    if (!formData.budget) {
      newErrors.budget = "Please select a budget range";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const result = await submitEnquiry(formData);

    setIsSubmitting(false);

    if (result.success) {
      setSubmitted(true);
    } else {
      setSubmitError(result.error);
    }
  };

  if (submitted) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-[60vh] bg-white">
        <div className="max-w-md w-full px-6 py-12 text-center space-y-6 border border-[#e8e0d5] bg-[#faf8f5] font-inter">
          <div className="w-16 h-16 bg-[#c9a465]/10 rounded-full flex items-center justify-center mx-auto text-[#c9a465]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-8 h-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
              Inquiry Received
            </h1>
            <p className="text-xs uppercase tracking-widest text-[#c9a465] font-semibold">
              Bespoke Bridal Consultation
            </p>
            <p className="text-sm text-[#4a4a4a] leading-relaxed pt-2">
              Thank you for sharing your design vision. Our Senior Atelier Representative will contact you via WhatsApp or phone call within 24 hours to schedule your virtual or in-person design consultation.
            </p>
          </div>
          <div className="pt-4">
            <Link
              href="/shop"
              className="inline-block bg-[#1a1a1a] text-white px-8 py-3.5 text-xs font-semibold uppercase tracking-widest hover:bg-[#333333] transition-colors"
            >
              Explore Collections
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-white">
      {/* 1. Header Banner */}
      <div className="bg-[#faf8f5] py-20 text-center border-b border-[#e8e0d5]/40 select-none">
        <div className="max-w-2xl mx-auto px-4 space-y-4">
          <h1 className="text-4xl sm:text-5xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
            Get a Custom Quote
          </h1>
          <p className="text-sm sm:text-base text-[#4a4a4a] leading-relaxed font-light font-inter">
            Tell us about your dream outfit and we'll craft it exclusively for you.
            <br />
            Experience the journey of bespoke Indian couture.
          </p>
        </div>
      </div>

      {/* 2. Form Container */}
      <div className="max-w-4xl mx-auto px-4 -mt-10 relative z-10 pb-24">
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-[#e8e0d5] p-8 sm:p-10 space-y-6 font-inter shadow-sm"
        >
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              placeholder="Enter your name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full border bg-white px-4 py-3 text-sm font-inter text-[#1a1a1a] placeholder:text-[#9a9a9a]/40 focus:outline-none focus:border-[#c9a465] rounded-none outline-none transition-colors duration-300 ${
                errors.name ? "border-red-500" : "border-[#e8e0d5]"
              }`}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
                Email
              </label>
              <input
                type="email"
                id="email"
                placeholder="example@domain.com"
                value={formData.email}
                onChange={handleChange}
                className={`w-full border bg-white px-4 py-3 text-sm font-inter text-[#1a1a1a] placeholder:text-[#9a9a9a]/40 focus:outline-none focus:border-[#c9a465] rounded-none outline-none transition-colors duration-300 ${
                  errors.email ? "border-red-500" : "border-[#e8e0d5]"
                }`}
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                placeholder="+91 00000 00000"
                value={formData.phone}
                onChange={handleChange}
                className={`w-full border bg-white px-4 py-3 text-sm font-inter text-[#1a1a1a] placeholder:text-[#9a9a9a]/40 focus:outline-none focus:border-[#c9a465] rounded-none outline-none transition-colors duration-300 ${
                  errors.phone ? "border-red-500" : "border-[#e8e0d5]"
                }`}
              />
              {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
            </div>
          </div>

          {/* Occasion & Budget */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
                Occasion
              </label>
              <select
                id="occasion"
                value={formData.occasion}
                onChange={handleChange}
                className={`w-full border bg-white px-4 py-3 text-sm font-inter text-[#1a1a1a] focus:outline-none focus:border-[#c9a465] rounded-none outline-none transition-colors duration-300 ${
                  errors.occasion ? "border-red-500" : "border-[#e8e0d5]"
                }`}
              >
                <option value="">Select Occasion</option>
                <option value="bridal">Bridal Lehenga</option>
                <option value="couture">Couture Saree</option>
                <option value="anarkali">Anarkali / Gown</option>
                <option value="groom">Groom Wear</option>
                <option value="other">Bespoke Couture</option>
              </select>
              {errors.occasion && <p className="text-xs text-red-500">{errors.occasion}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
                Budget Range
              </label>
              <select
                id="budget"
                value={formData.budget}
                onChange={handleChange}
                className={`w-full border bg-white px-4 py-3 text-sm font-inter text-[#1a1a1a] focus:outline-none focus:border-[#c9a465] rounded-none outline-none transition-colors duration-300 ${
                  errors.budget ? "border-red-500" : "border-[#e8e0d5]"
                }`}
              >
                <option value="">Select Budget</option>
                <option value="under-1l">Under ₹1,00,000</option>
                <option value="1l-2l">₹1,00,000 - ₹2,00,000</option>
                <option value="2l-3l">₹2,00,000 - ₹3,00,000</option>
                <option value="3l-5l">₹3,00,000 - ₹5,00,000</option>
                <option value="above-5l">₹5,00,000+</option>
              </select>
              {errors.budget && <p className="text-xs text-red-500">{errors.budget}</p>}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#9a9a9a]">
              Message
            </label>
            <textarea
              id="message"
              rows={5}
              placeholder="Describe your dream silhouette, embroidery preferences, and color palette..."
              value={formData.message}
              onChange={handleChange}
              className="w-full border border-[#e8e0d5] bg-white px-4 py-3 text-sm font-inter text-[#1a1a1a] placeholder:text-[#9a9a9a]/40 focus:outline-none focus:border-[#c9a465] rounded-none outline-none transition-colors duration-300 resize-none"
            />
          </div>

          {submitError && (
            <div role="alert" className="text-sm text-red-600 border border-red-200 bg-red-50 py-3 px-4 text-center">
              {submitError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#c9a465] hover:bg-[#d4b87a] text-white py-4 text-xs font-bold uppercase tracking-[0.2em] transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
          >
            {isSubmitting ? "Submitting Inquiry..." : "Submit Enquiry"}
          </button>
        </form>
      </div>

      {/* 3. The Bespoke Experience Section */}
      <section className="py-20 bg-[#faf8f5] border-t border-b border-[#e8e0d5]/40 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
              The Bespoke Experience
            </h2>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#c9a465]">
              Pure Craftsmanship
            </p>
          </div>

          {/* Three columns grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            {/* Column 1 */}
            <div className="space-y-4 max-w-sm mx-auto font-inter">
              <div className="border border-[#e8e0d5] w-12 h-12 flex items-center justify-center mx-auto text-[#c9a465] bg-white">
                {/* Exclusive Design Icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.2}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                  />
                </svg>
              </div>
              <h3 className="text-base font-light tracking-wide text-[#1a1a1a] font-cormorant uppercase">
                Exclusive Design
              </h3>
              <p className="text-sm text-[#6a6a6a] leading-relaxed font-light">
                One-of-a-kind silhouettes tailored to your personal aesthetic and wedding vision.
              </p>
            </div>

            {/* Column 2 */}
            <div className="space-y-4 max-w-sm mx-auto font-inter">
              <div className="border border-[#e8e0d5] w-12 h-12 flex items-center justify-center mx-auto text-[#c9a465] bg-white">
                {/* Master Artisans Icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.2}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 21l8.904-.813a1.875 1.875 0 001.693-1.693L20.25 7.5a1.875 1.875 0 00-1.875-1.875H6.375A1.875 1.875 0 004.5 7.5v11.004c0 1.03.84 1.87 1.87 1.87h1.75a1.875 1.875 0 001.693-1.47l.45-2.031z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v3M12 18v3M3 12h3M18 12h3"
                  />
                </svg>
              </div>
              <h3 className="text-base font-light tracking-wide text-[#1a1a1a] font-cormorant uppercase">
                Master Artisans
              </h3>
              <p className="text-sm text-[#6a6a6a] leading-relaxed font-light">
                Handcrafted by veteran karigars using centuries-old Zardosi and Aari techniques.
              </p>
            </div>

            {/* Column 3 */}
            <div className="space-y-4 max-w-sm mx-auto font-inter">
              <div className="border border-[#e8e0d5] w-12 h-12 flex items-center justify-center mx-auto text-[#c9a465] bg-white">
                {/* Perfect Fit Icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.2}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-light tracking-wide text-[#1a1a1a] font-cormorant uppercase">
                Perfect Fit
              </h3>
              <p className="text-sm text-[#6a6a6a] leading-relaxed font-light">
                Rigorous measurement and trial process to ensure flawless movement and drape.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Editorial Image Mosaic Grid */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 select-none">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Column 1: Large Red Embroidery Close-up */}
          <div className="relative aspect-[4/3] md:aspect-auto w-full border border-[#e8e0d5]/40 overflow-hidden min-h-[450px]">
            <Image
              src="/images/rose_lehenga.png"
              alt="Intricate zardosi embroidery close up"
              fill
              sizes="(max-w-7xl) 50vw, 100vw"
              className="object-cover"
            />
          </div>

          {/* Column 2: Nested Grid Layout */}
          <div className="flex flex-col justify-between gap-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Gold accessory thumbnail */}
              <div className="relative aspect-square w-full border border-[#e8e0d5]/40 overflow-hidden">
                <Image
                  src="/images/velvet_lehenga.png"
                  alt="Atelier craft detailed pattern view"
                  fill
                  sizes="(max-w-7xl) 25vw, 50vw"
                  className="object-cover"
                />
              </div>
              {/* Mannequin / Lehenga preview */}
              <div className="relative aspect-square w-full border border-[#e8e0d5]/40 overflow-hidden">
                <Image
                  src="/images/ivory_lehenga.png"
                  alt="Artisanal silhouette preview"
                  fill
                  sizes="(max-w-7xl) 25vw, 50vw"
                  className="object-cover"
                />
              </div>
            </div>

            {/* Bottom: Horizontal Boutique Interior preview */}
            <div className="relative aspect-[2/1] w-full border border-[#e8e0d5]/40 overflow-hidden">
              <Image
                src="/images/hero_lehenga.png"
                alt="MEI couture showroom view"
                fill
                sizes="(max-w-7xl) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
