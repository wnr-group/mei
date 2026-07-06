import type { Metadata } from "next";
import ContactClient from "./ContactClient";

export const metadata: Metadata = {
  title: "Get a Custom Quote | Bespoke Bridal Consultation",
  description:
    "Tell us about your dream outfit and our master karigars will craft it exclusively for you. Book your custom bridal consultation.",
};

export default function ContactPage() {
  return <ContactClient />;
}
