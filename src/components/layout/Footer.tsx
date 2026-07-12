import Link from "next/link";
import type { Category } from "@/types";

export default function Footer({ categories }: { categories: Category[] }) {
  return (
    <footer className="bg-white border-t border-[#e8e0d5] py-16 text-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand Column */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold  font-inter uppercase text-[#0B5563]">
              MEI BRIDAL COUTURE
            </h3>
            <p className="text-sm text-[#4a4a4a] leading-relaxed font-inter">
             Crafting timeless elegance and preserving heritage through bespoke couture.
            </p>
          </div>

          {/* Shop Links */}
          <div className="space-y-4">
            <h4 className="text-xs font-inter font-semibold uppercase tracking-widest text-[#c9a465]">
              QUICK LINKS
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/atelier"
                  className="text-sm text-[#4a4a4a] hover:text-[#c9a465] transition-colors duration-300 font-inter"
                >
                  The Atelier
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-[#4a4a4a] hover:text-[#c9a465] transition-colors duration-300 font-inter"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Collections */}
          <div className="space-y-4">
            <h4 className="text-xs font-inter font-semibold uppercase tracking-widest text-[#c9a465]">
              COLLECTIONS
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/new-arrivals" className="text-sm text-[#4a4a4a] hover:text-[#c9a465] transition-colors duration-300 font-inter">
                  New Arrivals
                </Link>
              </li>
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link href={`/shop/${cat.slug}`} className="text-sm text-[#4a4a4a] hover:text-[#c9a465] transition-colors duration-300 font-inter">
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Details */}
          <div className="space-y-4">
            <h4 className="text-xs font-inter font-semibold uppercase tracking-widest text-[#c9a465]">
              CONTACT
            </h4>
            <address className="space-y-2 text-sm text-[#4a4a4a] font-inter leading-relaxed not-italic">
              <p>
                17 Lourdh Swamy Pillai Street, Ayyappan Nagar,
                <br />
                K.K. Nagar (near Perumal Temple),
                <br />
                Tiruchirappalli, Tamil Nadu 620021
              </p>
              <p>
                <a
                  href="mailto:admin@couturemei.com"
                  className="hover:text-[#c9a465] transition-colors duration-300"
                >
                  Email us
                </a>
              </p>
              <p>
                <a
                  href="tel:+919930100431"
                  className="hover:text-[#c9a465] transition-colors duration-300"
                >
                  +91 99301 00431
                </a>
              </p>
            </address>
          </div>
        </div>

        <div className="mt-10 pt-4 border-t border-[#e8e0d5]  sm:flex-row  items-center align-middle">
          <p className="text-xs text-[#9a9a9a] uppercase tracking-wider font-inter text-center">
            © {new Date().getFullYear()} MEI Bridal Couture. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
