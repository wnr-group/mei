import type { Metadata } from "next";
import ContactClient from "./ContactClient";

export const metadata: Metadata = {
  title: "Contact & Bespoke Bridal Consultation",
  description:
    "Tell us about your dream outfit and our master karigars will craft it exclusively for you. Book your custom bridal consultation.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return <ContactClient />;
}
